import * as db from "./db.js";
import { initTimer } from "./timer.js";
import { renderProgressChart } from "./charts.js";
import { MUSCLES, MOVEMENTS, MOVEMENT_LABEL } from "./exerciseLibrary.js";
import { getWeekRange, computeVolume } from "./volume.js";
import { renderBodyMaps, applyVolumeColors } from "./bodyMap.js";

// ==================== Helpers ====================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

function fmtDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString();
}

function epley1RM(weight, reps) {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

// ==================== Tab navigation ====================
function initTabs() {
  const tabBtns = $$(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  $$(".view").forEach((v) => (v.hidden = v.dataset.view !== view));
  const tabForView = view === "library" || view === "exercise-form" ? "settings" : view;
  $$(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === tabForView));
  if (view === "history") renderHistory();
  if (view === "routines") renderRoutines();
  if (view === "progress") renderProgress();
  if (view === "library") renderLibrary();
  if (view === "log") {
    refreshExerciseDatalist();
    refreshRoutineQuickstart();
  }
}

// ==================== LOG VIEW ====================
let currentWorkout = { exercises: [] }; // in-memory draft

function refreshExerciseDatalist() {
  const dl = $("#exerciseOptions");
  dl.innerHTML = db.getExercises().map((e) => `<option value="${escapeHtml(e)}">`).join("");
}

function refreshRoutineQuickstart() {
  const routines = db.getRoutines();
  const wrap = $("#routineQuickstart");
  const select = $("#routineSelect");
  wrap.hidden = routines.length === 0;
  select.innerHTML = routines.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function addExerciseToWorkout(name, targetSets = 1, targetReps = null) {
  if (!name || !name.trim()) return;
  name = name.trim();
  const sets = [];
  for (let i = 0; i < Math.max(1, targetSets); i++) {
    sets.push({ reps: targetReps || null, weight: null, done: false });
  }
  currentWorkout.exercises.push({ exerciseName: name, sets });
  renderExerciseList();
}

function renderExerciseList() {
  const wrap = $("#exerciseList");
  wrap.innerHTML = "";
  const unit = db.getSettings().unit;

  currentWorkout.exercises.forEach((ex, exIdx) => {
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.innerHTML = `
      <div class="exercise-card-header">
        <h3>${escapeHtml(ex.exerciseName)}</h3>
        <button class="remove-exercise" data-ex="${exIdx}">Remove</button>
      </div>
      <div class="set-row-labels">
        <span>#</span><span>Weight (${unit})</span><span>Reps</span><span>✓</span>
      </div>
      <div class="sets-table" data-ex="${exIdx}"></div>
      <button class="add-set-btn" data-ex="${exIdx}">+ Add set</button>
    `;
    const setsTable = $(".sets-table", card);
    ex.sets.forEach((set, setIdx) => {
      const row = document.createElement("div");
      row.className = "set-row";
      row.innerHTML = `
        <span class="set-index">${setIdx + 1}</span>
        <input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" class="weight-input" value="${set.weight ?? ""}">
        <input type="number" inputmode="numeric" min="0" placeholder="0" class="reps-input" value="${set.reps ?? ""}">
        <button class="set-done ${set.done ? "checked" : ""}" data-ex="${exIdx}" data-set="${setIdx}">${set.done ? "✓" : ""}</button>
      `;
      $(".weight-input", row).addEventListener("input", (e) => {
        set.weight = e.target.value === "" ? null : parseFloat(e.target.value);
      });
      $(".reps-input", row).addEventListener("input", (e) => {
        set.reps = e.target.value === "" ? null : parseInt(e.target.value, 10);
      });
      $(".set-done", row).addEventListener("click", (e) => {
        set.done = !set.done;
        e.target.classList.toggle("checked", set.done);
        e.target.textContent = set.done ? "✓" : "";
        if (set.done) {
          openRestTimer(true);
        }
      });
      setsTable.appendChild(row);
    });
    wrap.appendChild(card);
  });

  $$(".remove-exercise", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      currentWorkout.exercises.splice(+btn.dataset.ex, 1);
      renderExerciseList();
    })
  );
  $$(".add-set-btn", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = currentWorkout.exercises[+btn.dataset.ex];
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({ reps: last?.reps ?? null, weight: last?.weight ?? null, done: false });
      renderExerciseList();
    })
  );
}

function resetLogForm() {
  currentWorkout = { exercises: [] };
  $("#workoutName").value = "";
  renderExerciseList();
  $("#workoutDate").textContent = fmtDate(new Date());
}

function initLogView() {
  $("#workoutDate").textContent = fmtDate(new Date());

  $("#addExerciseBtn").addEventListener("click", () => {
    const input = $("#exercisePicker");
    const name = input.value.trim();
    if (!name) return;
    db.addCustomExercise(name);
    addExerciseToWorkout(name);
    input.value = "";
    refreshExerciseDatalist();
  });
  $("#exercisePicker").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#addExerciseBtn").click();
    }
  });

  $("#loadRoutineBtn").addEventListener("click", () => {
    const id = $("#routineSelect").value;
    const routine = db.getRoutines().find((r) => r.id === id);
    if (!routine) return;
    routine.exercises.forEach((re) => addExerciseToWorkout(re.exerciseName, re.targetSets, re.targetReps));
    toast(`Loaded "${routine.name}"`);
  });

  $("#finishWorkoutBtn").addEventListener("click", () => {
    const loggedExercises = currentWorkout.exercises
      .map((ex) => ({
        exerciseName: ex.exerciseName,
        sets: ex.sets.filter((s) => s.weight != null || s.reps != null),
      }))
      .filter((ex) => ex.sets.length > 0);

    if (loggedExercises.length === 0) {
      toast("Add at least one set before saving");
      return;
    }

    const name = $("#workoutName").value.trim() || "Workout";
    db.saveWorkout({ date: todayISO(), name, exercises: loggedExercises });
    toast("Workout saved ✓");
    resetLogForm();
    refreshRoutineQuickstart();
    switchView("history");
  });

  resetLogForm();
  refreshExerciseDatalist();
  refreshRoutineQuickstart();
}

// ==================== HISTORY VIEW ====================
function workoutSummary(w) {
  const exCount = w.exercises.length;
  const setCount = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  return `${exCount} exercise${exCount === 1 ? "" : "s"} · ${setCount} set${setCount === 1 ? "" : "s"}`;
}

function renderHistory() {
  const listEl = $("#historyList");
  const query = ($("#historySearch").value || "").toLowerCase().trim();
  let workouts = db.getWorkouts();
  if (query) {
    workouts = workouts.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.exercises.some((ex) => ex.exerciseName.toLowerCase().includes(query))
    );
  }

  $("#historyEmpty").hidden = db.getWorkouts().length > 0;
  listEl.innerHTML = "";

  const unit = db.getSettings().unit;

  workouts.forEach((w) => {
    const card = document.createElement("div");
    card.className = "history-card";
    const detailHtml = w.exercises
      .map((ex) => {
        const setsStr = ex.sets
          .map((s) => `${s.reps ?? "?"}×${s.weight != null ? s.weight : "?"}${unit}`)
          .join(", ");
        return `<div class="ex-line"><span>${escapeHtml(ex.exerciseName)}</span><span>${setsStr}</span></div>`;
      })
      .join("");
    card.innerHTML = `
      <div class="history-card-top">
        <h3>${escapeHtml(w.name)}</h3>
        <span class="history-card-date">${fmtDate(w.date)}</span>
      </div>
      <div class="history-card-summary">${workoutSummary(w)}</div>
      <div class="history-card-detail">
        ${detailHtml}
        <div class="history-card-actions">
          <button class="btn secondary small dup-btn" data-id="${w.id}">Repeat</button>
          <button class="btn danger small del-btn" data-id="${w.id}">Delete</button>
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      card.classList.toggle("expanded");
    });
    listEl.appendChild(card);
  });

  $$(".del-btn", listEl).forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this workout? This can't be undone.")) {
        db.deleteWorkout(btn.dataset.id);
        renderHistory();
        toast("Workout deleted");
      }
    })
  );
  $$(".dup-btn", listEl).forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const w = db.getWorkout(btn.dataset.id);
      if (!w) return;
      currentWorkout = {
        exercises: w.exercises.map((ex) => ({
          exerciseName: ex.exerciseName,
          sets: ex.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false })),
        })),
      };
      $("#workoutName").value = w.name;
      renderExerciseList();
      switchView("log");
      toast("Loaded into Log — edit & save");
    })
  );
}

function initHistoryView() {
  $("#historySearch").addEventListener("input", renderHistory);
}

// ==================== ROUTINES VIEW ====================
let routineDraft = null; // { id?, name, exercises: [{exerciseName, targetSets, targetReps}] }

function renderRoutines() {
  const listEl = $("#routinesList");
  const routines = db.getRoutines();
  $("#routinesEmpty").hidden = routines.length > 0 || routineDraft;
  listEl.innerHTML = "";

  if (routineDraft) {
    listEl.appendChild(buildRoutineEditor());
  }

  routines.forEach((r) => {
    const card = document.createElement("div");
    card.className = "routine-card";
    card.innerHTML = `
      <div class="routine-card-top">
        <h3>${escapeHtml(r.name)}</h3>
      </div>
      <div class="routine-ex-list">
        ${r.exercises.map((e) => `<div>${escapeHtml(e.exerciseName)} — ${e.targetSets}×${e.targetReps || "?"}</div>`).join("")}
      </div>
      <div class="routine-card-actions">
        <button class="btn secondary small edit-r" data-id="${r.id}">Edit</button>
        <button class="btn danger small del-r" data-id="${r.id}">Delete</button>
      </div>
    `;
    listEl.appendChild(card);
  });

  $$(".edit-r", listEl).forEach((btn) =>
    btn.addEventListener("click", () => {
      const r = db.getRoutines().find((x) => x.id === btn.dataset.id);
      routineDraft = JSON.parse(JSON.stringify(r));
      renderRoutines();
    })
  );
  $$(".del-r", listEl).forEach((btn) =>
    btn.addEventListener("click", () => {
      if (confirm("Delete this routine?")) {
        db.deleteRoutine(btn.dataset.id);
        renderRoutines();
        toast("Routine deleted");
      }
    })
  );
}

function buildRoutineEditor() {
  const wrap = document.createElement("div");
  wrap.className = "routine-card";
  wrap.innerHTML = `
    <div class="field-label">Routine name</div>
    <input type="text" id="routineNameInput" value="${escapeHtml(routineDraft.name || "")}" placeholder="e.g. Push Day" />
    <div class="field-label" style="margin-top:12px">Exercises</div>
    <div id="routineExerciseRows"></div>
    <div class="add-exercise-row">
      <input type="text" id="routineExercisePicker" list="exerciseOptions" placeholder="Add exercise…" />
      <button class="btn secondary small" id="routineAddExBtn">+ Add</button>
    </div>
    <div class="routine-card-actions">
      <button class="btn primary small" id="routineSaveBtn">Save routine</button>
      <button class="btn ghost small" id="routineCancelBtn">Cancel</button>
    </div>
  `;

  function renderRows() {
    const rowsEl = $("#routineExerciseRows", wrap);
    rowsEl.innerHTML = routineDraft.exercises
      .map(
        (e, i) => `
      <div class="set-row" style="grid-template-columns: 1fr 60px 60px 30px; margin-bottom:6px;">
        <span style="font-size:13px; text-align:left;">${escapeHtml(e.exerciseName)}</span>
        <input type="number" min="1" value="${e.targetSets}" data-field="sets" data-i="${i}" style="text-align:center;">
        <input type="number" min="1" value="${e.targetReps || ""}" placeholder="reps" data-field="reps" data-i="${i}" style="text-align:center;">
        <button class="remove-exercise" data-i="${i}">✕</button>
      </div>
    `
      )
      .join("");
    $$("input[data-field]", rowsEl).forEach((inp) =>
      inp.addEventListener("input", () => {
        const i = +inp.dataset.i;
        if (inp.dataset.field === "sets") routineDraft.exercises[i].targetSets = parseInt(inp.value, 10) || 1;
        else routineDraft.exercises[i].targetReps = parseInt(inp.value, 10) || null;
      })
    );
    $$(".remove-exercise", rowsEl).forEach((btn) =>
      btn.addEventListener("click", () => {
        routineDraft.exercises.splice(+btn.dataset.i, 1);
        renderRows();
      })
    );
  }
  renderRows();

  $("#routineAddExBtn", wrap).addEventListener("click", () => {
    const input = $("#routineExercisePicker", wrap);
    const name = input.value.trim();
    if (!name) return;
    db.addCustomExercise(name);
    routineDraft.exercises.push({ exerciseName: name, targetSets: 3, targetReps: 10 });
    input.value = "";
    renderRows();
  });

  $("#routineSaveBtn", wrap).addEventListener("click", () => {
    routineDraft.name = $("#routineNameInput", wrap).value.trim() || "Routine";
    if (routineDraft.exercises.length === 0) {
      toast("Add at least one exercise");
      return;
    }
    db.saveRoutine(routineDraft);
    routineDraft = null;
    renderRoutines();
    toast("Routine saved ✓");
  });
  $("#routineCancelBtn", wrap).addEventListener("click", () => {
    routineDraft = null;
    renderRoutines();
  });

  return wrap;
}

function initRoutinesView() {
  $("#newRoutineBtn").addEventListener("click", () => {
    routineDraft = { name: "", exercises: [] };
    renderRoutines();
  });
}

// ==================== PROGRESS VIEW ====================
let progressSubTab = "strength";
let weekOffset = 0;

function renderProgress() {
  if (progressSubTab === "strength") renderStrengthProgress();
  else renderVolumeProgress();
}

function renderStrengthProgress() {
  const select = $("#progressExerciseSelect");
  const workouts = db.getWorkouts();
  const exerciseNames = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseName)))].sort();

  const prevValue = select.value;
  select.innerHTML = exerciseNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (exerciseNames.includes(prevValue)) select.value = prevValue;

  const chosen = select.value;
  $("#progressEmpty").hidden = true;
  $("#prCards").innerHTML = "";
  $("#progressChart").innerHTML = "";

  if (!chosen) {
    $("#progressEmpty").hidden = false;
    return;
  }

  const unit = db.getSettings().unit;
  // one datapoint per workout date, using best set that day (by est 1RM)
  const points = [];
  [...workouts]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((w) => {
      w.exercises
        .filter((ex) => ex.exerciseName === chosen)
        .forEach((ex) => {
          let best = null;
          ex.sets.forEach((s) => {
            if (s.weight == null) return;
            const oneRM = epley1RM(s.weight, s.reps || 1);
            if (!best || oneRM > best.oneRM) best = { oneRM, weight: s.weight, reps: s.reps };
          });
          if (best) {
            points.push({
              date: new Date(w.date),
              value: Math.round(best.oneRM),
              topWeight: best.weight,
              topReps: best.reps,
              label: new Date(w.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            });
          }
        });
    });

  if (points.length === 0) {
    $("#progressEmpty").hidden = false;
    return;
  }

  // mark PRs (running max)
  let runningMax = -Infinity;
  points.forEach((p) => {
    p.isPR = p.value > runningMax;
    if (p.isPR) runningMax = p.value;
  });

  const maxWeight = Math.max(...points.map((p) => p.topWeight));
  const best1RM = Math.max(...points.map((p) => p.value));
  const totalSessions = points.length;

  $("#prCards").innerHTML = `
    <div class="pr-card"><div class="pr-label">Max Weight</div><div class="pr-value">${maxWeight}${unit}</div></div>
    <div class="pr-card"><div class="pr-label">Best Est. 1RM</div><div class="pr-value">${best1RM}${unit}</div></div>
    <div class="pr-card"><div class="pr-label">Sessions</div><div class="pr-value">${totalSessions}</div></div>
  `;

  renderProgressChart($("#progressChart"), points, { yLabel: unit + " (est. 1RM)" });
}

function renderVolumeProgress() {
  const { start, end, label } = getWeekRange(weekOffset);
  $("#weekLabel").textContent = label;
  $("#weekNextBtn").disabled = weekOffset >= 0;

  const { muscleRows, movementRows, muscleTotals } = computeVolume(db.getWorkouts(), { start, end });

  applyVolumeColors($("#bodyFront"), $("#bodyBack"), muscleTotals);

  const bar = (row, maxSets) => `
    <div class="volume-bar-row">
      <span class="volume-bar-label"><span class="volume-bar-dot"></span>${escapeHtml(row.label)}</span>
      <span class="volume-bar-track"><span class="volume-bar-fill" style="width:${(row.sets / maxSets) * 100}%"></span></span>
      <span class="volume-bar-value">${row.sets} set${row.sets === 1 ? "" : "s"}</span>
    </div>`;

  const maxMuscle = muscleRows[0]?.sets || 1;
  $("#muscleBarList").innerHTML = muscleRows.map((r) => bar(r, maxMuscle)).join("");

  const maxMovement = movementRows[0]?.sets || 1;
  $("#movementBarList").innerHTML = movementRows.map((r) => bar(r, maxMovement)).join("");

  $("#volumeEmpty").hidden = muscleRows.length > 0;
}

function initProgressView() {
  $("#progressExerciseSelect").addEventListener("change", renderProgress);

  renderBodyMaps($("#bodyFront"), $("#bodyBack"));

  $$(".seg-btn", $("#progressSubnav")).forEach((btn) => {
    btn.addEventListener("click", () => {
      progressSubTab = btn.dataset.sub;
      $$(".seg-btn", $("#progressSubnav")).forEach((b) => b.classList.toggle("active", b === btn));
      $("#progressStrength").hidden = progressSubTab !== "strength";
      $("#progressVolume").hidden = progressSubTab !== "volume";
      renderProgress();
    });
  });

  $("#weekPrevBtn").addEventListener("click", () => {
    weekOffset -= 1;
    renderVolumeProgress();
  });
  $("#weekNextBtn").addEventListener("click", () => {
    if (weekOffset >= 0) return;
    weekOffset += 1;
    renderVolumeProgress();
  });
}

// ==================== EXERCISE LIBRARY ====================
let exerciseFormState = { originalName: null };

function movementTagLabel(key) {
  return MOVEMENT_LABEL[key] || key;
}

function renderLibrary() {
  const listEl = $("#libraryList");
  const all = db.getAllExerciseObjects();
  listEl.innerHTML = all
    .map((ex) => {
      const primary = MUSCLES.filter((m) => (ex.muscles || {})[m.key] === 1).map((m) => m.label);
      const secondary = MUSCLES.filter((m) => (ex.muscles || {})[m.key] === 0.5).map((m) => m.label);
      const tags = [
        `<span class="tag movement">${escapeHtml(movementTagLabel(ex.movement))}</span>`,
        ...primary.map((m) => `<span class="tag">${escapeHtml(m)}</span>`),
        ...secondary.map((m) => `<span class="tag">${escapeHtml(m)}·½</span>`),
      ].join("");
      return `
        <div class="library-row" data-name="${escapeHtml(ex.name)}">
          <div class="library-row-main">
            <h4>${escapeHtml(ex.name)}</h4>
            <div class="library-row-tags">${tags}</div>
          </div>
          <span class="library-row-chevron">›</span>
        </div>`;
    })
    .join("");

  $$(".library-row", listEl).forEach((row) =>
    row.addEventListener("click", () => openExerciseForm(row.dataset.name))
  );
}

function muscleGridHtml(containerId, checkedKeys) {
  return MUSCLES.map(
    (m) => `
    <label class="muscle-check">
      <input type="checkbox" data-muscle="${m.key}" data-group="${containerId}" ${checkedKeys.includes(m.key) ? "checked" : ""}>
      ${escapeHtml(m.label)}
    </label>`
  ).join("");
}

function openExerciseForm(name = null) {
  const isNew = !name;
  exerciseFormState = { originalName: name };

  $("#exerciseFormMovement").innerHTML = MOVEMENTS.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join("");

  let movement = "isolation";
  let muscles = {};
  if (!isNew) {
    const meta = db.getExerciseMeta(name);
    movement = meta.movement;
    muscles = meta.muscles || {};
  }

  $("#exerciseFormTitle").textContent = isNew ? "Add Exercise" : "Edit Exercise";
  $("#exerciseFormName").value = isNew ? "" : name;
  $("#exerciseFormMovement").value = movement;

  const primaryKeys = Object.keys(muscles).filter((k) => muscles[k] === 1);
  const secondaryKeys = Object.keys(muscles).filter((k) => muscles[k] === 0.5);
  $("#exerciseFormPrimary").innerHTML = muscleGridHtml("primary", primaryKeys);
  $("#exerciseFormSecondary").innerHTML = muscleGridHtml("secondary", secondaryKeys);

  // keep primary/secondary mutually exclusive
  $$("input[data-muscle]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      const other = cb.dataset.group === "primary" ? "secondary" : "primary";
      const twin = $(`input[data-muscle="${cb.dataset.muscle}"][data-group="${other}"]`);
      if (twin) twin.checked = false;
    });
  });

  const all = db.getAllExerciseObjects();
  const existing = all.find((e) => e.name === name);
  const canDelete = !isNew && existing && (existing.isCustom || existing.isOverride);
  $("#exerciseFormDeleteBtn").hidden = !canDelete;

  switchView("exercise-form");
}

function initLibraryView() {
  $("#openLibraryBtn").addEventListener("click", () => switchView("library"));
  $("#libraryBackBtn").addEventListener("click", () => switchView("settings"));
  $("#exerciseFormBackBtn").addEventListener("click", () => switchView("library"));
  $("#newExerciseBtn").addEventListener("click", () => openExerciseForm(null));

  $("#exerciseFormSaveBtn").addEventListener("click", () => {
    const name = $("#exerciseFormName").value.trim();
    if (!name) {
      toast("Name is required");
      return;
    }
    const movement = $("#exerciseFormMovement").value;
    const muscles = {};
    $$('input[data-muscle][data-group="primary"]').forEach((cb) => {
      if (cb.checked) muscles[cb.dataset.muscle] = 1;
    });
    $$('input[data-muscle][data-group="secondary"]').forEach((cb) => {
      if (cb.checked && muscles[cb.dataset.muscle] !== 1) muscles[cb.dataset.muscle] = 0.5;
    });
    db.saveCustomExercise({ name, movement, muscles }, exerciseFormState.originalName);
    toast("Exercise saved ✓");
    refreshExerciseDatalist();
    switchView("library");
  });

  $("#exerciseFormDeleteBtn").addEventListener("click", () => {
    if (!confirm(`Remove "${exerciseFormState.originalName}" from your library? Past workouts keep the name either way.`)) return;
    db.deleteCustomExercise(exerciseFormState.originalName);
    toast("Exercise removed");
    refreshExerciseDatalist();
    switchView("library");
  });
}

// ==================== SETTINGS VIEW ====================
function initSettingsView() {
  const settings = db.getSettings();
  $$(".seg-btn", $("#unitSegmented")).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.unit === settings.unit);
    btn.addEventListener("click", () => {
      db.saveSettings({ unit: btn.dataset.unit });
      $$(".seg-btn", $("#unitSegmented")).forEach((b) => b.classList.toggle("active", b === btn));
      toast(`Units set to ${btn.dataset.unit}`);
    });
  });

  $("#restTimerDefault").value = settings.restTimerDefault;
  $("#restTimerDefault").addEventListener("change", (e) => {
    const v = Math.max(10, parseInt(e.target.value, 10) || 90);
    db.saveSettings({ restTimerDefault: v });
    e.target.value = v;
  });

  $("#exportBtn").addEventListener("click", () => {
    const data = db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `fitlog-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    $("#settingsMsg").textContent = "Backup downloaded. Move it somewhere safe (Drive, computer, etc).";
  });

  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm("Import this backup? It will overwrite your current data.")) {
        e.target.value = "";
        return;
      }
      db.importAll(data);
      toast("Backup imported ✓");
      $("#settingsMsg").textContent = `Imported backup from ${data.exportedAt ? new Date(data.exportedAt).toLocaleString() : "file"}.`;
      refreshExerciseDatalist();
      refreshRoutineQuickstart();
    } catch (err) {
      alert("Couldn't read that file. Make sure it's a FitLog backup JSON.");
      console.error(err);
    }
    e.target.value = "";
  });

  $("#clearDataBtn").addEventListener("click", () => {
    if (confirm("Delete ALL workouts, routines, and custom exercises? This cannot be undone.")) {
      if (confirm("Really sure? This is permanent.")) {
        db.clearAll();
        resetLogForm();
        refreshExerciseDatalist();
        refreshRoutineQuickstart();
        toast("All data deleted");
      }
    }
  });
}

// ==================== REST TIMER (floating panel) ====================
let restTimerCtl = null;

function openRestTimer(autoStart = false) {
  $("#restTimer").hidden = false;
  if (autoStart) restTimerCtl.restart();
}

function initRestTimer() {
  restTimerCtl = initTimer({
    display: $("#restTimerDisplay"),
    startPauseBtn: $("#restTimerStartPause"),
    plusBtn: $("#restTimerPlus"),
    minusBtn: $("#restTimerMinus"),
    resetBtn: $("#restTimerReset"),
  });
  $("#restTimerToggle").addEventListener("click", () => {
    $("#restTimer").hidden = !$("#restTimer").hidden;
  });
  $("#restTimerClose").addEventListener("click", () => {
    $("#restTimer").hidden = true;
  });
}

// ==================== INIT ====================
function init() {
  initTabs();
  initLogView();
  initHistoryView();
  initRoutinesView();
  initProgressView();
  initLibraryView();
  initSettingsView();
  initRestTimer();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
