// ---------- Background cloud sync (FitLog -> Fitness Dashboard) ----------
// FitLog stays fully local-first: every read/write still goes straight to
// localStorage, nothing about the offline logging experience changes. This
// is a best-effort layer on top -- once signed in (same 6-digit PIN as the
// dashboard), every save/delete gets queued and pushed to Supabase. If
// there's no network or no session yet, items just stay queued in
// localStorage and get retried on the next save, the next "online" event,
// or the next app open -- nothing is ever silently dropped.
import { supabase } from "./supabaseClient.js";
import * as db from "./db.js";

const QUEUE_KEY = "fitlog_sync_queue";
const AUTH_EMAIL = "carlos.alvarez9@upr.edu";

// Mirrors the dashboard's own auth.js: Supabase's password policy requires
// more than the 6 digits alone, so the PIN gets padded the same way here.
// The UI still only ever asks for 6 digits.
function toSupabasePassword(pin) {
  return `fit-${pin}-dash`;
}

function readQueue() {
  try {
    return { workouts: [], deletedWorkouts: [], exercises: [], deletedExercises: [], ...JSON.parse(localStorage.getItem(QUEUE_KEY)) };
  } catch {
    return { workouts: [], deletedWorkouts: [], exercises: [], deletedExercises: [] };
  }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function enqueue(list, key, removeFromLists = []) {
  const q = readQueue();
  if (!q[list].includes(key)) q[list].push(key);
  removeFromLists.forEach((l) => {
    q[l] = q[l].filter((x) => x !== key);
  });
  writeQueue(q);
  flushSyncQueue();
}

export function queueWorkoutSync(id) {
  enqueue("workouts", id, ["deletedWorkouts"]);
}
export function queueWorkoutDelete(id) {
  enqueue("deletedWorkouts", id, ["workouts"]);
}
export function queueExerciseSync(name) {
  enqueue("exercises", name, ["deletedExercises"]);
}
export function queueExerciseDelete(name) {
  enqueue("deletedExercises", name, ["exercises"]);
}

export function pendingCount() {
  const q = readQueue();
  return q.workouts.length + q.deletedWorkouts.length + q.exercises.length + q.deletedExercises.length;
}

// ---------- Pushing a single item (mirrors the dashboard's own
// importFitLogBackup, just one workout/exercise at a time instead of a
// whole file) ----------
async function pushWorkout(workout) {
  const type = workout.type === "cardio" ? "cardio" : "strength";
  const { error: wErr } = await supabase.from("fitlog_workouts").upsert(
    {
      id: workout.id,
      date: workout.date,
      started_at: workout.startedAt || null,
      duration_min: workout.durationMin ?? null,
      name: workout.name || (type === "cardio" ? "Cardio" : "Workout"),
      notes: workout.notes || null,
      type,
      raw: workout,
    },
    { onConflict: "id" }
  );
  if (wErr) throw wErr;

  await supabase.from("fitlog_sets").delete().eq("workout_id", workout.id);
  await supabase.from("fitlog_cardio_segments").delete().eq("workout_id", workout.id);

  if (type === "cardio" && Array.isArray(workout.segments)) {
    const rows = workout.segments.map((s) => ({
      workout_id: workout.id,
      activity_type: s.activityType,
      duration_min: s.durationMin,
      distance: s.distance,
      calories: s.calories,
      avg_hr: s.avgHr,
      max_hr: s.maxHr,
    }));
    if (rows.length) {
      const { error } = await supabase.from("fitlog_cardio_segments").insert(rows);
      if (error) throw error;
    }
  } else if (Array.isArray(workout.exercises)) {
    const rows = [];
    workout.exercises.forEach((ex) => {
      (ex.sets || []).forEach((s, i) => {
        rows.push({
          workout_id: workout.id,
          exercise_name: ex.exerciseName,
          set_index: i,
          reps: s.reps,
          weight: s.weight,
          duration: s.duration,
          rpe: s.rpe,
          is_warmup: !!s.isWarmup,
          done: !!s.done,
        });
      });
    });
    if (rows.length) {
      const { error } = await supabase.from("fitlog_sets").insert(rows);
      if (error) throw error;
    }
  }
}

async function pushWorkoutDelete(id) {
  const { error } = await supabase.from("fitlog_workouts").delete().eq("id", id);
  if (error) throw error;
}

async function pushExercise(entry) {
  const { error } = await supabase
    .from("exercise_overrides")
    .upsert(
      { name: entry.name, movement: entry.movement, muscles: entry.muscles || {}, athleticism: entry.athleticism || 0, joint_load: entry.jointLoad || {} },
      { onConflict: "name" }
    );
  if (error) throw error;
}

async function pushExerciseDelete(name) {
  const { error } = await supabase.from("exercise_overrides").delete().eq("name", name);
  if (error) throw error;
}

// ---------- Flush: attempt every queued item, drop only the ones that
// actually succeed; anything that fails (offline, transient error) just
// stays queued for the next attempt. ----------
let flushing = false;

export async function flushSyncQueue() {
  if (flushing) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return; // not signed in yet -- stays queued until sign-in

  flushing = true;
  try {
    const q = readQueue();

    for (const id of [...q.workouts]) {
      const workout = db.getWorkout(id);
      if (!workout) {
        const q2 = readQueue();
        q2.workouts = q2.workouts.filter((x) => x !== id);
        writeQueue(q2);
        continue;
      }
      try {
        await pushWorkout(workout);
        const q2 = readQueue();
        q2.workouts = q2.workouts.filter((x) => x !== id);
        writeQueue(q2);
      } catch (e) {
        console.warn("sync: workout push failed, will retry", id, e);
      }
    }

    for (const id of [...q.deletedWorkouts]) {
      try {
        await pushWorkoutDelete(id);
        const q2 = readQueue();
        q2.deletedWorkouts = q2.deletedWorkouts.filter((x) => x !== id);
        writeQueue(q2);
      } catch (e) {
        console.warn("sync: workout delete failed, will retry", id, e);
      }
    }

    for (const name of [...q.exercises]) {
      const entry = db.getAllExerciseObjects().find((e) => e.name === name);
      if (!entry) {
        const q2 = readQueue();
        q2.exercises = q2.exercises.filter((x) => x !== name);
        writeQueue(q2);
        continue;
      }
      try {
        await pushExercise(entry);
        const q2 = readQueue();
        q2.exercises = q2.exercises.filter((x) => x !== name);
        writeQueue(q2);
      } catch (e) {
        console.warn("sync: exercise push failed, will retry", name, e);
      }
    }

    for (const name of [...q.deletedExercises]) {
      try {
        await pushExerciseDelete(name);
        const q2 = readQueue();
        q2.deletedExercises = q2.deletedExercises.filter((x) => x !== name);
        writeQueue(q2);
      } catch (e) {
        console.warn("sync: exercise delete failed, will retry", name, e);
      }
    }
  } finally {
    flushing = false;
  }
}

// ---------- Auth (same account, same PIN, as the dashboard) ----------
export async function isSignedIn() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

export async function signIn(pin) {
  if (!/^\d{6}$/.test(pin)) throw new Error("Enter your 6-digit PIN.");
  const { error } = await supabase.auth.signInWithPassword({ email: AUTH_EMAIL, password: toSupabasePassword(pin) });
  if (error) throw error;
  await flushSyncQueue();
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Call once at app startup: retries anything left over from a previous
// session (e.g. logged workouts while offline), and keeps retrying
// whenever the device comes back online.
export function initSync() {
  window.addEventListener("online", () => flushSyncQueue());
  flushSyncQueue();
}
