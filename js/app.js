import * as db from "./db.js";
import { renderProgressChart } from "./charts.js";
import { MUSCLES, MOVEMENTS, MOVEMENT_LABEL, JOINTS, METRIC_TYPES } from "./exerciseLibrary.js";
import { getWeekRange, computeVolume } from "./volume.js";
import { renderBodyMaps, applyVolumeColors } from "./bodyMap.js";
import { initSync, isSignedIn, signIn, signOut, flushSyncQueue, pendingCount } from "./sync.js";
import { loadCloudHistory, getCloudWorkouts, onCloudHistoryLoaded } from "./cloudHistory.js";

// Local history plus whatever's in the cloud (a Boostcamp import, or
// another device) that never touched this browser's storage -- deduped by
// id, since a workout logged here and already synced up would otherwise
// show up twice. Local wins on a collision; it's the richer/authoritative
// copy for anything actually logged in FitLog itself.
function allWorkouts() {
  const local = db.getWorkouts();
  const localIds = new Set(local.map((w) => w.id));
  return [...local, ...getCloudWorkouts().filter((w) => !localIds.has(w.id))];
}

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

// Best-ever set for an exercise (by est. 1RM), from already-saved workouts
// only -- the workout currently being logged isn't saved yet, so this
// naturally only ever shows real history, never today's own numbers.
// "Best" means something different per logging type -- there's no single
// formula that covers weight x reps, a held time, a rep count, and a
// weight x time carry all at once, so each type picks the metric that
// actually answers "was this a PR" for that kind of set.
// location: only applied when usesCableEquipment is true -- a barbell PR is
// the same everywhere, but two gyms' cable stacks can genuinely differ, so
// cable exercises' "best" is scoped to whichever gym you're currently
// logging at instead of being a mixed-gym number.
function bestSetFor(exerciseName, metricType = "weighted", usesCableEquipment = false, location = null) {
  let best = null;
  allWorkouts().forEach((w) => {
    if (w.type === "cardio") return;
    if (usesCableEquipment && location && (w.location || null) !== location) return;
    w.exercises.forEach((ex) => {
      if (ex.exerciseName !== exerciseName) return;
      ex.sets.forEach((s) => {
        if (s.isWarmup) return;
        if (metricType === "bodyweight") {
          if (s.reps == null) return;
          if (!best || s.reps > best.reps) best = { reps: s.reps };
        } else if (metricType === "isometric") {
          if (s.duration == null) return;
          if (!best || s.duration > best.duration) best = { duration: s.duration };
        } else if (metricType === "loadedCarry") {
          if (s.weight == null) return;
          if (!best || s.weight > best.weight || (s.weight === best.weight && (s.duration || 0) > (best.duration || 0))) {
            best = { weight: s.weight, duration: s.duration };
          }
        } else {
          if (s.weight == null) return;
          const oneRM = epley1RM(s.weight, s.reps || 1);
          if (!best || oneRM > best.oneRM) best = { oneRM, weight: s.weight, reps: s.reps };
        }
      });
    });
  });
  return best;
}

function formatBestSet(best, metricType, unit, usesCableEquipment, location) {
  const locationSuffix = usesCableEquipment && location ? ` at ${location}` : "";
  if (metricType === "bodyweight") return `Best: ${best.reps} reps${locationSuffix}`;
  if (metricType === "isometric") return `Best: ${best.duration}s hold${locationSuffix}`;
  if (metricType === "loadedCarry") return `Best: ${best.weight}${unit}${best.duration ? ` × ${best.duration}s` : ""}${locationSuffix}`;
  return `Best: ${best.weight}${unit} × ${best.reps}${locationSuffix}`;
}

// Past sessions (most recent first) that included this exercise, with just
// its working sets -- for the "Recent" panel on the Log view's exercise
// card, so PRs/recent performances are visible right where you're logging
// instead of needing to navigate to Progress. Location is carried on every
// session regardless of exercise type -- only cable exercises' display
// actually shows it (see renderRecentPerformancesHtml), but it costs
// nothing to always collect.
function recentPerformancesFor(exerciseName, limit = 5) {
  const sessions = [];
  allWorkouts().forEach((w) => {
    if (w.type === "cardio") return;
    w.exercises.forEach((ex) => {
      if (ex.exerciseName !== exerciseName) return;
      const workingSets = ex.sets.filter((s) => !s.isWarmup && (s.weight != null || s.reps != null || s.duration != null));
      if (workingSets.length) sessions.push({ date: w.date, location: w.location || null, sets: workingSets });
    });
  });
  return sessions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
}

function formatSetSummary(set, metricType, unit) {
  if (metricType === "bodyweight") return `${set.reps} reps`;
  if (metricType === "isometric") return `${set.duration}s`;
  if (metricType === "loadedCarry") return `${set.weight}${unit}${set.duration ? ` × ${set.duration}s` : ""}`;
  return set.weight != null ? `${set.weight}${unit}×${set.reps ?? "?"}` : `${set.reps} reps`;
}

function renderRecentPerformancesHtml(exerciseName, unit, metricType = "weighted", usesCableEquipment = false) {
  const sessions = recentPerformancesFor(exerciseName);
  if (!sessions.length) return `<p class="muted small">No past sessions yet.</p>`;
  return sessions
    .map((s) => {
      const dateLabel = new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const dateWithLocation = usesCableEquipment && s.location ? `${dateLabel} · ${s.location}` : dateLabel;
      const setsLabel = s.sets.map((set) => formatSetSummary(set, metricType, unit)).join(", ");
      return `<div class="recent-performance-row"><span class="recent-performance-date">${escapeHtml(dateWithLocation)}</span><span>${escapeHtml(setsLabel)}</span></div>`;
    })
    .join("");
}

// "7:42 /mi" style pace string from minutes + distance, or null if either is missing/zero.
function formatPace(durationMin, distance, unit) {
  if (!durationMin || !distance) return null;
  const paceMin = durationMin / distance;
  const min = Math.floor(paceMin);
  const sec = Math.round((paceMin - min) * 60);
  const mm = sec === 60 ? min + 1 : min;
  const ss = sec === 60 ? 0 : sec;
  return `${mm}:${String(ss).padStart(2, "0")} /${unit}`;
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
    refreshCardioDatalist();
    refreshRoutineQuickstart();
  }
}

// ==================== LOG VIEW ====================
let currentWorkout = { exercises: [] }; // in-memory draft
// Set on the first exercise/cardio activity added after a reset, so a saved
// workout carries both a start and finish time (finish = todayISO() at save).
// Lets anything cross-referencing against Garmin activity times (e.g. the
// dashboard's workout linking) compute a real overlap instead of guessing
// from a single point in time.
let workoutStartedAt = null;

function markWorkoutStarted() {
  if (!workoutStartedAt) workoutStartedAt = new Date().toISOString();
}

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
  markWorkoutStarted();
  const sets = [];
  for (let i = 0; i < Math.max(1, targetSets); i++) {
    sets.push({ reps: targetReps || null, weight: null, rpe: null, done: false });
  }
  currentWorkout.exercises.push({ exerciseName: name, sets, linkedToNext: false });
  renderExerciseList();
}

// Groups consecutive exercises chained via linkedToNext into supersets.
// Returns [{ letter: 'A'|null, indices: [i, ...] }]; letter is null for solo exercises.
function computeExerciseGroups(exercises) {
  const groups = [];
  let i = 0;
  let letterCode = 65; // 'A'
  while (i < exercises.length) {
    const indices = [i];
    while (exercises[indices[indices.length - 1]]?.linkedToNext && indices[indices.length - 1] + 1 < exercises.length) {
      indices.push(indices[indices.length - 1] + 1);
    }
    groups.push({ letter: indices.length > 1 ? String.fromCharCode(letterCode++) : null, indices });
    i = indices[indices.length - 1] + 1;
  }
  return groups;
}

function suggestWarmups(ex) {
  if (ex.sets.some((s) => s.isWarmup)) {
    toast("Warm-ups already added");
    return;
  }
  const target = ex.sets.find((s) => s.weight != null)?.weight;
  if (!target) {
    toast("Enter a working weight first");
    return;
  }
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  const warmups = [
    { reps: 8, weight: round5(target * 0.4), rpe: null, done: false, isWarmup: true },
    { reps: 5, weight: round5(target * 0.6), rpe: null, done: false, isWarmup: true },
    { reps: 3, weight: round5(target * 0.8), rpe: null, done: false, isWarmup: true },
  ];
  ex.sets.unshift(...warmups);
  renderExerciseList();
}

// What a set-row looks like for each logging type -- which inputs it shows
// (in order), and the CSS column-count class that matches. "field" is the
// property name on the set object; "kind" picks the input's type/step/
// placeholder. Weighted (weight x reps) and Loaded Carry (weight x time)
// both keep the full 5 columns; Bodyweight and Isometric drop to 4 since
// there's one fewer input.
function setRowFields(metricType, unit) {
  switch (metricType) {
    case "bodyweight":
      return { cols: 4, fields: [{ field: "reps", kind: "reps", label: "Reps" }] };
    case "isometric":
      return { cols: 4, fields: [{ field: "duration", kind: "duration", label: "Time (s)" }] };
    case "loadedCarry":
      return {
        cols: 5,
        fields: [
          { field: "weight", kind: "weight", label: `Weight (${unit})` },
          { field: "duration", kind: "duration", label: "Time (s)" },
        ],
      };
    default: // "weighted"
      return {
        cols: 5,
        fields: [
          { field: "reps", kind: "reps", label: "Reps" },
          { field: "weight", kind: "weight", label: `Weight (${unit})` },
        ],
      };
  }
}

function setFieldInputHtml(kind, value) {
  if (kind === "reps") return `<input type="number" inputmode="numeric" min="0" placeholder="0" class="reps-input" value="${value ?? ""}">`;
  if (kind === "weight") return `<input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" class="weight-input" value="${value ?? ""}">`;
  if (kind === "duration") return `<input type="number" inputmode="numeric" step="1" min="0" placeholder="0" class="duration-input" value="${value ?? ""}">`;
  return "";
}

function renderExerciseList() {
  const wrap = $("#exerciseList");
  wrap.innerHTML = "";
  const unit = db.getSettings().unit;
  const groups = computeExerciseGroups(currentWorkout.exercises);

  groups.forEach((group) => {
    const groupWrap = group.letter ? document.createElement("div") : wrap;
    if (group.letter) {
      groupWrap.className = "superset-group";
      groupWrap.innerHTML = `<div class="superset-label">Superset ${group.letter}</div>`;
      wrap.appendChild(groupWrap);
    }

    group.indices.forEach((exIdx) => {
      const ex = currentWorkout.exercises[exIdx];
      const hasNext = exIdx < currentWorkout.exercises.length - 1;
      const isFirst = exIdx === 0;
      const isLast = exIdx === currentWorkout.exercises.length - 1;
      const exMeta = db.getExerciseMeta(ex.exerciseName);
      const metricType = exMeta.metricType || "weighted";
      const usesCableEquipment = !!exMeta.usesCableEquipment;
      const best = bestSetFor(ex.exerciseName, metricType, usesCableEquipment, currentWorkout.location);
      const rowConfig = setRowFields(metricType, unit);
      const colsClass = rowConfig.cols === 4 ? " cols-4" : "";
      const card = document.createElement("div");
      card.className = "exercise-card";
      card.innerHTML = `
        <div class="exercise-card-header">
          <button type="button" class="exercise-name-display" data-ex="${exIdx}" title="Edit movement/muscles/athleticism">${escapeHtml(ex.exerciseName)} <span class="exercise-name-edit-hint">✎ edit</span></button>
          <div class="exercise-card-actions">
            <button class="move-exercise-up" data-ex="${exIdx}" title="Move up" ${isFirst ? "disabled" : ""}>▲</button>
            <button class="move-exercise-down" data-ex="${exIdx}" title="Move down" ${isLast ? "disabled" : ""}>▼</button>
            ${hasNext ? `<button class="link-exercise ${ex.linkedToNext ? "active" : ""}" data-ex="${exIdx}" title="Superset with next exercise">🔗</button>` : ""}
            <button class="swap-exercise" data-ex="${exIdx}" title="Swap exercise">⇄</button>
            <button class="remove-exercise" data-ex="${exIdx}">Remove</button>
          </div>
        </div>
        ${
          best
            ? `<button type="button" class="exercise-recent-toggle muted small" data-ex="${exIdx}">${formatBestSet(best, metricType, unit, usesCableEquipment, currentWorkout.location)} <span class="recent-toggle-hint">· Recent ▾</span></button>
               <div class="exercise-recent-performances" data-ex="${exIdx}" hidden></div>`
            : // No history anywhere (local or cloud) -- say so plainly instead
              // of rendering nothing, so the exercise name above (which opens
              // the editor, not history) isn't the only tappable text here.
              `<p class="muted small exercise-no-history">No past sessions yet.</p>`
        }
        <div class="set-row-labels${colsClass}">
          <span>#</span>${rowConfig.fields.map((f) => `<span>${escapeHtml(f.label)}</span>`).join("")}<span>RPE</span><span>✓</span>
        </div>
        <div class="sets-table" data-ex="${exIdx}"></div>
        <div class="exercise-card-footer">
          <button class="add-set-btn" data-ex="${exIdx}">+ Add set</button>
          ${metricType === "weighted" ? `<button class="warmup-btn" data-ex="${exIdx}">✨ Add warm-ups</button>` : ""}
        </div>
      `;
      const setsTable = $(".sets-table", card);
      ex.sets.forEach((set, setIdx) => {
        const row = document.createElement("div");
        row.className = "set-row" + colsClass + (set.isWarmup ? " warmup-row" : "");
        row.innerHTML = `
          <span class="set-index">${set.isWarmup ? "W" : setIdx + 1}</span>
          ${rowConfig.fields.map((f) => setFieldInputHtml(f.kind, set[f.field])).join("")}
          <input type="number" inputmode="decimal" step="0.5" min="0" max="10" placeholder="—" class="rpe-input" value="${set.rpe ?? ""}">
          <button class="set-done ${set.done ? "checked" : ""}" data-ex="${exIdx}" data-set="${setIdx}">${set.done ? "✓" : ""}</button>
        `;
        rowConfig.fields.forEach((f) => {
          const selector = f.kind === "reps" ? ".reps-input" : f.kind === "weight" ? ".weight-input" : ".duration-input";
          $(selector, row).addEventListener("input", (e) => {
            const v = e.target.value === "" ? null : f.kind === "reps" || f.kind === "duration" ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
            set[f.field] = v;
          });
        });
        $(".rpe-input", row).addEventListener("input", (e) => {
          set.rpe = e.target.value === "" ? null : parseFloat(e.target.value);
        });
        $(".set-done", row).addEventListener("click", (e) => {
          set.done = !set.done;
          e.target.classList.toggle("checked", set.done);
          e.target.textContent = set.done ? "✓" : "";
        });
        setsTable.appendChild(row);
      });
      groupWrap.appendChild(card);
    });
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
      ex.sets.push({ reps: last?.reps ?? null, weight: last?.weight ?? null, duration: last?.duration ?? null, rpe: null, done: false });
      renderExerciseList();
    })
  );
  $$(".warmup-btn", wrap).forEach((btn) =>
    btn.addEventListener("click", () => suggestWarmups(currentWorkout.exercises[+btn.dataset.ex]))
  );
  $$(".link-exercise", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = currentWorkout.exercises[+btn.dataset.ex];
      ex.linkedToNext = !ex.linkedToNext;
      renderExerciseList();
    })
  );
  $$(".swap-exercise", wrap).forEach((btn) =>
    btn.addEventListener("click", () => startExerciseSwap(+btn.dataset.ex))
  );
  $$(".exercise-recent-toggle", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const exIdx = +btn.dataset.ex;
      const ex = currentWorkout.exercises[exIdx];
      const panel = $(`.exercise-recent-performances[data-ex="${exIdx}"]`, wrap);
      if (!panel.hidden) {
        panel.hidden = true;
        return;
      }
      const exMeta = db.getExerciseMeta(ex.exerciseName);
      panel.innerHTML = renderRecentPerformancesHtml(ex.exerciseName, db.getSettings().unit, exMeta.metricType || "weighted", !!exMeta.usesCableEquipment);
      panel.hidden = false;
    })
  );
  $$(".exercise-name-display", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const ex = currentWorkout.exercises[+btn.dataset.ex];
      openExerciseForm(ex.exerciseName, "log");
    })
  );
  $$(".move-exercise-up", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = +btn.dataset.ex;
      if (i <= 0) return;
      const [moved] = currentWorkout.exercises.splice(i, 1);
      currentWorkout.exercises.splice(i - 1, 0, moved);
      renderExerciseList();
    })
  );
  $$(".move-exercise-down", wrap).forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = +btn.dataset.ex;
      if (i >= currentWorkout.exercises.length - 1) return;
      const [moved] = currentWorkout.exercises.splice(i, 1);
      currentWorkout.exercises.splice(i + 1, 0, moved);
      renderExerciseList();
    })
  );
}

function startExerciseSwap(exIdx) {
  const nameEl = $(`.exercise-name-display[data-ex="${exIdx}"]`);
  if (!nameEl) return;
  const ex = currentWorkout.exercises[exIdx];
  const wrap = document.createElement("div");
  wrap.className = "swap-input-row";
  wrap.innerHTML = `
    <input type="text" class="swap-input" list="exerciseOptions" value="${escapeHtml(ex.exerciseName)}" autocomplete="off">
    <button class="icon-btn small swap-confirm" aria-label="Confirm swap">✓</button>
  `;
  nameEl.replaceWith(wrap);
  const input = $(".swap-input", wrap);
  input.focus();
  input.select();

  function confirm() {
    const newName = input.value.trim();
    if (newName) {
      db.addCustomExercise(newName);
      ex.exerciseName = newName;
    }
    renderExerciseList();
    refreshExerciseDatalist();
  }
  $(".swap-confirm", wrap).addEventListener("click", confirm);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
    if (e.key === "Escape") renderExerciseList();
  });
}

// ==================== LOG VIEW: cardio ====================
let currentCardio = { segments: [] }; // in-memory draft
let logSubTab = "strength";

function refreshCardioDatalist() {
  const dl = $("#cardioOptions");
  dl.innerHTML = db.getCardioTypes().map((t) => `<option value="${escapeHtml(t)}">`).join("");
}

function addCardioActivity(type) {
  if (!type || !type.trim()) return;
  markWorkoutStarted();
  currentCardio.segments.push({
    activityType: type.trim(),
    durationMin: null,
    distance: null,
    calories: null,
    avgHr: null,
    maxHr: null,
  });
  renderCardioList();
}

function renderCardioList() {
  const wrap = $("#cardioList");
  wrap.innerHTML = "";
  const distUnit = db.getSettings().distanceUnit;

  const numberField = (label, key, seg, opts = {}) => `
    <div class="cardio-field">
      <label>${label}</label>
      <input type="number" inputmode="decimal" min="0" step="${opts.step || 1}" placeholder="${opts.placeholder || "—"}"
        class="cardio-input" data-key="${key}" value="${seg[key] ?? ""}">
    </div>`;

  currentCardio.segments.forEach((seg, idx) => {
    const card = document.createElement("div");
    card.className = "exercise-card cardio-card";
    const pace = formatPace(seg.durationMin, seg.distance, distUnit);
    card.innerHTML = `
      <div class="exercise-card-header">
        <h3>${escapeHtml(seg.activityType)}</h3>
        <button class="remove-exercise" data-idx="${idx}">Remove</button>
      </div>
      <div class="cardio-field-grid">
        ${numberField("Duration (min)", "durationMin", seg, { step: 0.5 })}
        ${numberField(`Distance (${distUnit})`, "distance", seg, { step: 0.1 })}
      </div>
      <div class="cardio-pace ${pace ? "" : "muted"}">${pace ? `Pace: ${pace}` : "Enter duration + distance for pace"}</div>
      <div class="cardio-field-grid thirds">
        ${numberField("Calories", "calories", seg)}
        ${numberField("Avg HR", "avgHr", seg)}
        ${numberField("Max HR", "maxHr", seg)}
      </div>
    `;
    $$(".cardio-input", card).forEach((input) => {
      input.addEventListener("input", (e) => {
        const v = e.target.value;
        seg[e.target.dataset.key] = v === "" ? null : parseFloat(v);
        $(".cardio-pace", card).outerHTML = (() => {
          const p = formatPace(seg.durationMin, seg.distance, distUnit);
          return `<div class="cardio-pace ${p ? "" : "muted"}">${p ? `Pace: ${p}` : "Enter duration + distance for pace"}</div>`;
        })();
      });
    });
    $(".remove-exercise", card).addEventListener("click", () => {
      currentCardio.segments.splice(idx, 1);
      renderCardioList();
    });
    wrap.appendChild(card);
  });
}

function resetLogForm() {
  currentWorkout = { exercises: [], location: db.getSettings().lastLocation };
  currentCardio = { segments: [] };
  workoutStartedAt = null;
  $("#workoutName").value = "";
  $("#workoutNotes").value = "";
  renderExerciseList();
  renderCardioList();
  $("#workoutDate").textContent = fmtDate(new Date());
  renderLocationSelect();
}

// Only meaningful for cable-machine exercises -- see usesCableEquipment in
// exerciseLibrary.js. Defaults to whatever was last used (set*Location
// below), so switching only takes action when you actually change gyms.
function renderLocationSelect() {
  const sel = $("#workoutLocation");
  const locations = db.getLocations();
  sel.innerHTML = locations.map((loc) => `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`).join("");
  sel.value = currentWorkout.location || locations[0];
  currentWorkout.location = sel.value;
}

function setLogSubTab(sub) {
  logSubTab = sub;
  $$(".seg-btn", $("#logSubnav")).forEach((b) => b.classList.toggle("active", b.dataset.sub === sub));
  $("#logStrength").hidden = sub !== "strength";
  $("#logCardio").hidden = sub !== "cardio";
}

function initLogView() {
  $("#workoutDate").textContent = fmtDate(new Date());
  renderLocationSelect();
  $("#workoutLocation").addEventListener("change", (e) => {
    currentWorkout.location = e.target.value;
    db.saveSettings({ lastLocation: e.target.value });
    // Re-render so any cable exercise's Best/Recent immediately reflects
    // the new location instead of staying stale until something else
    // happens to trigger a re-render.
    renderExerciseList();
  });

  $$(".seg-btn", $("#logSubnav")).forEach((btn) =>
    btn.addEventListener("click", () => setLogSubTab(btn.dataset.sub))
  );

  $("#addCardioBtn").addEventListener("click", () => {
    const input = $("#cardioTypePicker");
    const type = input.value.trim();
    if (!type) return;
    db.addCustomCardioType(type);
    addCardioActivity(type);
    input.value = "";
    refreshCardioDatalist();
  });
  $("#cardioTypePicker").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#addCardioBtn").click();
    }
  });

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
    const status = mesoStatus(routine);
    const statusMsg = status ? (status.deload ? " — deload week" : ` — week ${status.weekNum} of ${status.totalWeeks}`) : "";
    toast(`Loaded "${routine.name}"${statusMsg}`);
  });

  $("#finishWorkoutBtn").addEventListener("click", () => {
    const name = $("#workoutName").value.trim() || (logSubTab === "cardio" ? "Cardio" : "Workout");
    const notes = $("#workoutNotes").value.trim();
    const finishedAt = todayISO();
    // durationMin is only meaningful when we actually saw the session start
    // (markWorkoutStarted() fires on the first exercise/cardio add) --
    // absent for any workout logged before this field existed.
    const durationMin = workoutStartedAt
      ? Math.round(((new Date(finishedAt) - new Date(workoutStartedAt)) / 60000) * 10) / 10
      : null;

    if (logSubTab === "strength") {
      const loggedExercises = currentWorkout.exercises
        .map((ex) => ({
          exerciseName: ex.exerciseName,
          linkedToNext: !!ex.linkedToNext,
          sets: ex.sets.filter((s) => s.weight != null || s.reps != null || s.duration != null),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (loggedExercises.length === 0) {
        toast("Add at least one set before saving");
        return;
      }
      db.saveWorkout({
        type: "strength",
        date: finishedAt,
        startedAt: workoutStartedAt,
        durationMin,
        name,
        notes,
        location: currentWorkout.location || null,
        exercises: loggedExercises,
      });
    } else {
      const loggedSegments = currentCardio.segments.filter((s) => s.durationMin != null || s.distance != null);
      if (loggedSegments.length === 0) {
        toast("Add a duration or distance before saving");
        return;
      }
      db.saveWorkout({
        type: "cardio",
        date: finishedAt,
        startedAt: workoutStartedAt,
        durationMin,
        name,
        notes,
        segments: loggedSegments,
      });
    }

    toast("Workout saved ✓");
    resetLogForm();
    refreshRoutineQuickstart();
    switchView("history");
  });

  resetLogForm();
  refreshExerciseDatalist();
  refreshCardioDatalist();
  refreshRoutineQuickstart();
}

// ==================== HISTORY VIEW ====================
function isCardio(w) {
  return w.type === "cardio";
}

function workoutSummary(w) {
  if (isCardio(w)) {
    const distUnit = db.getSettings().distanceUnit;
    const n = w.segments.length;
    const totalMin = w.segments.reduce((s, seg) => s + (seg.durationMin || 0), 0);
    const totalDist = w.segments.reduce((s, seg) => s + (seg.distance || 0), 0);
    const parts = [`${n} activit${n === 1 ? "y" : "ies"}`];
    if (totalMin) parts.push(`${round1(totalMin)} min`);
    if (totalDist) parts.push(`${round1(totalDist)} ${distUnit}`);
    return parts.join(" · ");
  }
  const exCount = w.exercises.length;
  const setCount = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  return `${exCount} exercise${exCount === 1 ? "" : "s"} · ${setCount} set${setCount === 1 ? "" : "s"}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function cardioSegmentLine(seg, distUnit) {
  const parts = [];
  if (seg.durationMin != null) parts.push(`${round1(seg.durationMin)} min`);
  if (seg.distance != null) parts.push(`${round1(seg.distance)} ${distUnit}`);
  const pace = formatPace(seg.durationMin, seg.distance, distUnit);
  if (pace) parts.push(pace);
  if (seg.avgHr != null || seg.maxHr != null) {
    parts.push(`${seg.avgHr ?? "?"}${seg.maxHr != null ? "/" + seg.maxHr : ""} bpm`);
  }
  if (seg.calories != null) parts.push(`${seg.calories} cal`);
  return parts.join(" · ");
}

// ---------- Weekly summary ----------
function getWeeklySummary() {
  const { start, end, label } = getWeekRange(0);
  const all = db.getWorkouts();
  const thisWeek = all.filter((w) => {
    const d = new Date(w.date);
    return d >= start && d <= end;
  });
  const before = all.filter((w) => new Date(w.date) < start);

  const strengthThisWeek = thisWeek.filter((w) => !isCardio(w));
  const cardioThisWeek = thisWeek.filter(isCardio);

  const totalSets = strengthThisWeek.reduce(
    (n, w) => n + w.exercises.reduce((m, ex) => m + ex.sets.filter((s) => !s.isWarmup).length, 0),
    0
  );
  const cardioMinutes = cardioThisWeek.reduce((n, w) => n + w.segments.reduce((m, s) => m + (s.durationMin || 0), 0), 0);

  const priorBest = {};
  before
    .filter((w) => !isCardio(w))
    .forEach((w) =>
      w.exercises.forEach((ex) =>
        ex.sets
          .filter((s) => !s.isWarmup && s.weight != null)
          .forEach((s) => {
            const rm = epley1RM(s.weight, s.reps || 1);
            if (!priorBest[ex.exerciseName] || rm > priorBest[ex.exerciseName]) priorBest[ex.exerciseName] = rm;
          })
      )
    );

  const prs = [];
  strengthThisWeek.forEach((w) =>
    w.exercises.forEach((ex) =>
      ex.sets
        .filter((s) => !s.isWarmup && s.weight != null)
        .forEach((s) => {
          const rm = epley1RM(s.weight, s.reps || 1);
          const prior = priorBest[ex.exerciseName];
          if (prior != null && rm > prior && !prs.some((p) => p.name === ex.exerciseName)) {
            prs.push({ name: ex.exerciseName, weight: s.weight, reps: s.reps });
          }
        })
    )
  );

  return {
    label,
    sessions: thisWeek.length,
    totalSets,
    cardioMinutes: round1(cardioMinutes),
    prs,
  };
}

function renderWeekSummary() {
  const el = $("#weekSummaryCard");
  const s = getWeeklySummary();
  if (s.sessions === 0) {
    el.innerHTML = `<div class="week-summary-empty">No workouts logged yet this week (${escapeHtml(s.label)}).</div>`;
    return;
  }
  const stats = [
    { label: "Sessions", value: s.sessions },
    { label: "Sets", value: s.totalSets },
  ];
  if (s.cardioMinutes) stats.push({ label: "Cardio min", value: s.cardioMinutes });

  el.innerHTML = `
    <div class="week-summary-head">
      <span class="week-summary-title">This Week</span>
      <span class="muted small">${escapeHtml(s.label)}</span>
    </div>
    <div class="week-summary-stats">
      ${stats.map((st) => `<div class="ws-stat"><div class="ws-stat-value">${st.value}</div><div class="ws-stat-label">${st.label}</div></div>`).join("")}
    </div>
    ${
      s.prs.length
        ? `<div class="week-summary-prs">🎉 PR${s.prs.length > 1 ? "s" : ""}: ${s.prs
            .map((p) => `${escapeHtml(p.name)} (${p.reps ?? "?"}×${p.weight})`)
            .join(", ")}</div>`
        : ""
    }
  `;
}

function renderHistory() {
  renderWeekSummary();
  const listEl = $("#historyList");
  const query = ($("#historySearch").value || "").toLowerCase().trim();
  let workouts = db.getWorkouts();
  if (query) {
    workouts = workouts.filter((w) => {
      if (w.name.toLowerCase().includes(query)) return true;
      if (isCardio(w)) return w.segments.some((s) => s.activityType.toLowerCase().includes(query));
      return w.exercises.some((ex) => ex.exerciseName.toLowerCase().includes(query));
    });
  }

  $("#historyEmpty").hidden = db.getWorkouts().length > 0;
  listEl.innerHTML = "";

  const unit = db.getSettings().unit;
  const distUnit = db.getSettings().distanceUnit;

  workouts.forEach((w) => {
    const card = document.createElement("div");
    card.className = "history-card";
    const cardio = isCardio(w);

    const detailHtml = cardio
      ? w.segments
          .map((seg) => `<div class="ex-line"><span>${escapeHtml(seg.activityType)}</span><span>${cardioSegmentLine(seg, distUnit)}</span></div>`)
          .join("")
      : w.exercises
          .map((ex, i) => {
            const setsStr = ex.sets
              .map((s) => {
                const rpe = s.rpe != null ? ` @${s.rpe}` : "";
                const warmupTag = s.isWarmup ? " w" : "";
                return `${s.reps ?? "?"}×${s.weight != null ? s.weight : "?"}${unit}${rpe}${warmupTag}`;
              })
              .join(", ");
            const link = ex.linkedToNext && w.exercises[i + 1] ? " 🔗" : "";
            return `<div class="ex-line"><span>${escapeHtml(ex.exerciseName)}${link}</span><span>${setsStr}</span></div>`;
          })
          .join("");

    card.innerHTML = `
      <div class="history-card-top">
        <h3>${cardio ? '<span class="tag movement">Cardio</span> ' : ""}${escapeHtml(w.name)}</h3>
        <span class="history-card-date">${fmtDate(w.date)}</span>
      </div>
      <div class="history-card-summary">${workoutSummary(w)}</div>
      <div class="history-card-detail">
        ${cardio ? "" : `<div class="history-card-bodymap bodymap-row" data-id="${w.id}"></div>`}
        ${detailHtml}
        ${w.notes ? `<div class="history-card-notes">"${escapeHtml(w.notes)}"</div>` : ""}
        <div class="history-card-actions">
          <button class="btn secondary small dup-btn" data-id="${w.id}">Repeat</button>
          <button class="btn danger small del-btn" data-id="${w.id}">Delete</button>
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      card.classList.toggle("expanded");
      // Body map is built lazily on first expand, not for every card up
      // front -- with a lot of history that's a lot of anatomical SVGs to
      // build for cards that may never get opened.
      if (card.classList.contains("expanded")) renderHistoryCardBodyMap(w);
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
      $("#workoutName").value = w.name;
      markWorkoutStarted();
      if (isCardio(w)) {
        currentCardio = { segments: w.segments.map((s) => ({ ...s })) };
        renderCardioList();
        setLogSubTab("cardio");
      } else {
        currentWorkout = {
          exercises: w.exercises.map((ex) => ({
            exerciseName: ex.exerciseName,
            linkedToNext: !!ex.linkedToNext,
            sets: ex.sets.filter((s) => !s.isWarmup).map((s) => ({ reps: s.reps, weight: s.weight, duration: s.duration, rpe: null, done: false })),
          })),
          location: db.getSettings().lastLocation,
        };
        renderExerciseList();
        setLogSubTab("strength");
      }
      renderLocationSelect();
      switchView("log");
      toast("Loaded into Log — edit & save");
    })
  );
}

// Where one workout's own work went -- same figure/coloring as the
// aggregate Muscle Volume view in Progress, just scoped to this workout's
// own sets. Built once per card, on its first expand (see renderHistory).
function renderHistoryCardBodyMap(w) {
  const wrap = document.querySelector(`.history-card-bodymap[data-id="${w.id}"]`);
  if (!wrap || wrap.dataset.rendered) return;

  const muscleTotals = Object.fromEntries(MUSCLES.map((m) => [m.key, 0]));
  w.exercises.forEach((ex) => {
    const meta = db.getExerciseMeta(ex.exerciseName);
    ex.sets.forEach((s) => {
      if (s.isWarmup) return;
      Object.entries(meta.muscles || {}).forEach(([muscle, frac]) => {
        muscleTotals[muscle] = (muscleTotals[muscle] || 0) + frac;
      });
    });
  });
  if (!Object.values(muscleTotals).some((v) => v > 0)) return;

  wrap.dataset.rendered = "1";
  wrap.innerHTML = `
    <figure class="bodymap-figure"><svg viewBox="0 0 724 1448"></svg><figcaption>Front</figcaption></figure>
    <figure class="bodymap-figure"><svg viewBox="724 0 724 1448"></svg><figcaption>Back</figcaption></figure>
  `;
  const [frontSvg, backSvg] = wrap.querySelectorAll("svg");
  renderBodyMaps(frontSvg, backSvg);
  applyVolumeColors(frontSvg, backSvg, muscleTotals);
}

function initHistoryView() {
  $("#historySearch").addEventListener("input", renderHistory);
}

// ==================== ROUTINES VIEW ====================
let routineDraft = null; // { id?, name, exercises: [{exerciseName, targetSets, targetReps}] }

// Week X of Y + deload flag from a routine's mesocycle settings, or null if unset.
function mesoStatus(routine) {
  if (!routine.mesocycleWeeks || !routine.cycleStartDate) return null;
  const daysSince = Math.floor((Date.now() - new Date(routine.cycleStartDate)) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(daysSince / 7) + 1;
  return { weekNum, totalWeeks: routine.mesocycleWeeks, deload: weekNum > routine.mesocycleWeeks };
}

function mesoBadgeHtml(routine) {
  const status = mesoStatus(routine);
  if (!status) return "";
  return status.deload
    ? `<span class="tag deload">Deload suggested</span>`
    : `<span class="tag movement">Week ${status.weekNum} of ${status.totalWeeks}</span>`;
}

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
        ${mesoBadgeHtml(r)}
      </div>
      <div class="routine-ex-list">
        ${r.exercises.map((e) => `<div>${escapeHtml(e.exerciseName)} — ${e.targetSets}×${e.targetReps || "?"}</div>`).join("")}
      </div>
      <div class="routine-card-actions">
        <button class="btn secondary small edit-r" data-id="${r.id}">Edit</button>
        ${r.mesocycleWeeks ? `<button class="btn secondary small restart-r" data-id="${r.id}">Start New Cycle</button>` : ""}
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
  $$(".restart-r", listEl).forEach((btn) =>
    btn.addEventListener("click", () => {
      const r = db.getRoutines().find((x) => x.id === btn.dataset.id);
      if (!r) return;
      r.cycleStartDate = todayISO();
      db.saveRoutine(r);
      renderRoutines();
      toast("New cycle started — Week 1");
    })
  );
}

function buildRoutineEditor() {
  const wrap = document.createElement("div");
  wrap.className = "routine-card";
  wrap.innerHTML = `
    <div class="field-label">Routine name</div>
    <input type="text" id="routineNameInput" value="${escapeHtml(routineDraft.name || "")}" placeholder="e.g. Push Day" />
    <div class="field-label" style="margin-top:12px">Mesocycle length (weeks, optional)</div>
    <input type="number" id="routineMesoInput" min="1" max="16" placeholder="e.g. 5" value="${routineDraft.mesocycleWeeks || ""}" />
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
    const mesoVal = parseInt($("#routineMesoInput", wrap).value, 10);
    routineDraft.mesocycleWeeks = mesoVal > 0 ? mesoVal : null;
    if (routineDraft.mesocycleWeeks && !routineDraft.cycleStartDate) {
      routineDraft.cycleStartDate = todayISO();
    }
    if (!routineDraft.mesocycleWeeks) routineDraft.cycleStartDate = null;
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
            if (s.weight == null || s.isWarmup) return;
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

// Purely descriptive, no "good"/"bad" framing -- rising joint load isn't
// inherently bad, it's a fatigue-management signal to be aware of, same
// spirit as the dashboard's own period-comparison deltas.
function jointDeltaText(current, prev) {
  if (!current && !prev) return "no load logged";
  if (!prev) return "new this week";
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return "same as last wk";
  return `${pct > 0 ? "+" : ""}${pct}% vs last wk`;
}

function renderVolumeProgress() {
  const { start, end, label } = getWeekRange(weekOffset);
  $("#weekLabel").textContent = label;
  $("#weekNextBtn").disabled = weekOffset >= 0;

  const workouts = db.getWorkouts();
  const { muscleRows, movementRows, muscleTotals, jointRows, jointTotals, strengthSets, athleticismScore, cardioMinutes } = computeVolume(workouts, {
    start,
    end,
  });

  $("#emphasisCards").innerHTML = `
    <div class="pr-card"><div class="pr-label">Strength</div><div class="pr-value">${strengthSets}</div><div class="pr-sub">working sets</div></div>
    <div class="pr-card"><div class="pr-label">Athleticism</div><div class="pr-value">${athleticismScore}</div><div class="pr-sub">credited sets</div></div>
    <div class="pr-card"><div class="pr-label">Cardio</div><div class="pr-value">${Math.round(cardioMinutes)}</div><div class="pr-sub">minutes</div></div>
  `;

  const prevRange = getWeekRange(weekOffset - 1);
  const { jointTotals: prevJointTotals } = computeVolume(workouts, { start: prevRange.start, end: prevRange.end });
  $("#jointLoadCards").innerHTML = jointRows
    .map(
      (j) =>
        `<div class="pr-card"><div class="pr-label">${escapeHtml(j.label)}</div><div class="pr-value">${j.load}</div><div class="pr-sub">${jointDeltaText(jointTotals[j.key], prevJointTotals[j.key])}</div></div>`
    )
    .join("");

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
let librarySort = "name";

function movementTagLabel(key) {
  return MOVEMENT_LABEL[key] || key;
}

function renderLibrary() {
  const listEl = $("#libraryList");
  const all = db.getAllExerciseObjects();
  if (librarySort === "recent") {
    all.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    all.sort((a, b) => a.name.localeCompare(b.name));
  }
  listEl.innerHTML = all
    .map((ex) => {
      const primary = MUSCLES.filter((m) => (ex.muscles || {})[m.key] === 1).map((m) => m.label);
      const secondary = MUSCLES.filter((m) => (ex.muscles || {})[m.key] === 0.5).map((m) => m.label);
      const tags = [
        `<span class="tag movement">${escapeHtml(movementTagLabel(ex.movement))}</span>`,
        ...(ex.athleticism ? [`<span class="tag athleticism">⚡ ${ex.athleticism}</span>`] : []),
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

function openExerciseForm(name = null, returnTo = "library") {
  const isNew = !name;
  exerciseFormState = { originalName: name, returnTo };

  $("#exerciseFormMovement").innerHTML = MOVEMENTS.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join("");
  $("#exerciseFormMetricType").innerHTML = METRIC_TYPES.map((m) => `<option value="${m.key}">${escapeHtml(m.label)}</option>`).join("");

  let movement = "isolation";
  let muscles = {};
  let athleticism = 0;
  let jointLoad = {};
  let metricType = "weighted";
  let usesCableEquipment = false;
  if (!isNew) {
    const meta = db.getExerciseMeta(name);
    movement = meta.movement;
    muscles = meta.muscles || {};
    athleticism = meta.athleticism || 0;
    jointLoad = meta.jointLoad || {};
    metricType = meta.metricType || "weighted";
    usesCableEquipment = !!meta.usesCableEquipment;
  }

  $("#exerciseFormTitle").textContent = isNew ? "Add Exercise" : "Edit Exercise";
  $("#exerciseFormName").value = isNew ? "" : name;
  $("#exerciseFormMovement").value = movement;
  $("#exerciseFormMetricType").value = metricType;
  $("#exerciseFormCable").checked = usesCableEquipment;
  $("#exerciseFormAthleticism").value = athleticism || "";
  JOINTS.forEach((j) => {
    $(`#exerciseFormJoint-${j.key}`).value = jointLoad[j.key] || "";
  });

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
  $("#exerciseFormBackBtn").addEventListener("click", () => switchView(exerciseFormState.returnTo || "library"));
  $("#newExerciseBtn").addEventListener("click", () => openExerciseForm(null));
  $("#librarySort").addEventListener("change", (e) => {
    librarySort = e.target.value;
    renderLibrary();
  });

  $("#exerciseFormSaveBtn").addEventListener("click", () => {
    const name = $("#exerciseFormName").value.trim();
    if (!name) {
      toast("Name is required");
      return;
    }
    const movement = $("#exerciseFormMovement").value;
    const metricType = $("#exerciseFormMetricType").value;
    const usesCableEquipment = $("#exerciseFormCable").checked;
    const athleticism = parseFloat($("#exerciseFormAthleticism").value) || 0;
    const jointLoad = {};
    JOINTS.forEach((j) => {
      const v = parseFloat($(`#exerciseFormJoint-${j.key}`).value);
      if (v) jointLoad[j.key] = v;
    });
    const muscles = {};
    $$('input[data-muscle][data-group="primary"]').forEach((cb) => {
      if (cb.checked) muscles[cb.dataset.muscle] = 1;
    });
    $$('input[data-muscle][data-group="secondary"]').forEach((cb) => {
      if (cb.checked && muscles[cb.dataset.muscle] !== 1) muscles[cb.dataset.muscle] = 0.5;
    });
    db.saveCustomExercise({ name, movement, muscles, athleticism, jointLoad, metricType, usesCableEquipment }, exerciseFormState.originalName);
    toast("Exercise saved ✓");
    refreshExerciseDatalist();
    if (exerciseFormState.returnTo === "log") renderExerciseList();
    switchView(exerciseFormState.returnTo || "library");
  });

  $("#exerciseFormDeleteBtn").addEventListener("click", () => {
    if (!confirm(`Remove "${exerciseFormState.originalName}" from your library? Past workouts keep the name either way.`)) return;
    db.deleteCustomExercise(exerciseFormState.originalName);
    toast("Exercise removed");
    refreshExerciseDatalist();
    if (exerciseFormState.returnTo === "log") renderExerciseList();
    switchView(exerciseFormState.returnTo || "library");
  });
}

// ==================== SETTINGS VIEW ====================
async function renderSyncStatus() {
  const signedIn = await isSignedIn();
  $("#syncSignedOut").hidden = signedIn;
  $("#syncSignedIn").hidden = !signedIn;
  if (signedIn) {
    const n = pendingCount();
    $("#syncStatus").textContent = n > 0 ? `${n} pending…` : "Synced ✓";
  }
}

function initSyncSettings() {
  renderSyncStatus();

  $("#syncSignInBtn").addEventListener("click", async () => {
    const pin = $("#syncPin").value.trim();
    $("#syncError").hidden = true;
    $("#syncSignInBtn").disabled = true;
    $("#syncSignInBtn").textContent = "Signing in…";
    try {
      await signIn(pin);
      $("#syncPin").value = "";
      toast("Cloud sync enabled ✓");
      await renderSyncStatus();
    } catch (e) {
      $("#syncError").textContent = e.message;
      $("#syncError").hidden = false;
    }
    $("#syncSignInBtn").disabled = false;
    $("#syncSignInBtn").textContent = "Sign in";
  });
  $("#syncPin").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#syncSignInBtn").click();
  });

  $("#syncNowBtn").addEventListener("click", async () => {
    $("#syncNowBtn").disabled = true;
    $("#syncStatus").textContent = "Syncing…";
    await flushSyncQueue();
    await renderSyncStatus();
    $("#syncNowBtn").disabled = false;
  });

  $("#syncSignOutBtn").addEventListener("click", async () => {
    await signOut();
    toast("Cloud sync turned off");
    await renderSyncStatus();
  });
}

function renderLocationsList() {
  const listEl = $("#locationsList");
  const locations = db.getLocations();
  listEl.innerHTML = locations
    .map(
      (loc) =>
        `<div class="location-row"><span>${escapeHtml(loc)}</span><button class="icon-btn small remove-location-btn" data-loc="${escapeHtml(loc)}" aria-label="Remove ${escapeHtml(loc)}">✕</button></div>`
    )
    .join("");
  $$(".remove-location-btn", listEl).forEach((btn) =>
    btn.addEventListener("click", () => {
      const locations = db.getLocations().filter((l) => l !== btn.dataset.loc);
      if (!locations.length) {
        toast("Keep at least one location");
        return;
      }
      db.saveLocations(locations);
      renderLocationsList();
    })
  );
}

function initSettingsView() {
  const settings = db.getSettings();
  initSyncSettings();
  renderLocationsList();
  $("#addLocationBtn").addEventListener("click", () => {
    const input = $("#newLocationInput");
    const name = input.value.trim();
    if (!name) return;
    const locations = db.getLocations();
    if (locations.some((l) => l.toLowerCase() === name.toLowerCase())) {
      toast("That location already exists");
      return;
    }
    db.saveLocations([...locations, name]);
    input.value = "";
    renderLocationsList();
  });
  $$(".seg-btn", $("#unitSegmented")).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.unit === settings.unit);
    btn.addEventListener("click", () => {
      db.saveSettings({ unit: btn.dataset.unit });
      $$(".seg-btn", $("#unitSegmented")).forEach((b) => b.classList.toggle("active", b === btn));
      toast(`Units set to ${btn.dataset.unit}`);
    });
  });

  $$(".seg-btn", $("#distanceUnitSegmented")).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.unit === settings.distanceUnit);
    btn.addEventListener("click", () => {
      db.saveSettings({ distanceUnit: btn.dataset.unit });
      $$(".seg-btn", $("#distanceUnitSegmented")).forEach((b) => b.classList.toggle("active", b === btn));
      toast(`Distance unit set to ${btn.dataset.unit}`);
    });
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

// ==================== INIT ====================
function init() {
  initTabs();
  initLogView();
  initHistoryView();
  initRoutinesView();
  initProgressView();
  initLibraryView();
  initSettingsView();
  initSync(); // background, doesn't block anything above
  // Also background -- the Log view already rendered with local-only
  // history by the time this resolves; re-render once it's in so
  // Best:/Recent picks up anything that only exists in the cloud
  // (a Boostcamp import, or another device) without the user waiting on it.
  loadCloudHistory().then(() => renderExerciseList());

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
