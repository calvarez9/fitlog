// ---------- Best-effort read-only cloud history ----------
// sync.js is FitLog's only write path to Supabase (local -> cloud, one
// way). This is the read path back the other way: pulling in past
// sessions that live in Supabase but never touched this browser's local
// storage -- most commonly a Boostcamp import, but also just "logged on
// a different phone." Without this, "Best:"/Recent on the Log view only
// ever sees what THIS device has locally, which is exactly why an
// exercise you've only ever done through Boostcamp shows no history at
// all even though the dashboard clearly has it.
//
// Read-only and best-effort: if it's slow, offline, or errors, the Log
// view just keeps using local-only history until/unless this resolves.
// Nothing about the offline logging experience depends on this succeeding.
import { supabase } from "./supabaseClient.js";

let cloudWorkouts = []; // same shape as a local db workout, so bestSetFor/recentPerformancesFor can merge it in untouched
let loaded = false;
let waiters = [];

export function getCloudWorkouts() {
  return cloudWorkouts;
}

// Fires immediately if the load already finished (including a failed one
// that resolved to "no cloud data") -- callers don't need to know whether
// they're early or late.
export function onCloudHistoryLoaded(cb) {
  if (loaded) cb();
  else waiters.push(cb);
}

export async function loadCloudHistory() {
  try {
    const { data: workouts, error: wErr } = await supabase.from("fitlog_workouts").select("id, date, type").neq("type", "cardio");
    if (wErr) throw wErr;

    const ids = (workouts || []).map((w) => w.id);
    let sets = [];
    if (ids.length) {
      const { data, error } = await supabase
        .from("fitlog_sets")
        .select("workout_id, exercise_name, set_index, reps, weight, duration, rpe, is_warmup")
        .in("workout_id", ids);
      if (error) throw error;
      sets = data || [];
    }

    const setsByWorkout = new Map();
    sets.forEach((s) => {
      if (!setsByWorkout.has(s.workout_id)) setsByWorkout.set(s.workout_id, []);
      setsByWorkout.get(s.workout_id).push(s);
    });

    cloudWorkouts = (workouts || []).map((w) => {
      const rows = (setsByWorkout.get(w.id) || []).sort((a, b) => (a.set_index ?? 0) - (b.set_index ?? 0));
      const byExercise = new Map();
      rows.forEach((s) => {
        if (!byExercise.has(s.exercise_name)) byExercise.set(s.exercise_name, []);
        byExercise.get(s.exercise_name).push({
          reps: s.reps,
          weight: s.weight,
          duration: s.duration,
          rpe: s.rpe,
          isWarmup: !!s.is_warmup,
        });
      });
      return {
        id: w.id,
        date: w.date,
        type: w.type,
        // Cloud-origin sessions (a Boostcamp import, or another device)
        // don't carry a FitLog gym location -- bestSetFor's per-location
        // cable-equipment scoping already treats an unset location as "not
        // this location" and excludes it from THAT specific comparison,
        // which is the right call here: we genuinely don't know which gym
        // a Boostcamp cable-row PR happened at. Every non-cable exercise
        // (the vast majority) is unaffected and merges in normally.
        location: null,
        exercises: [...byExercise.entries()].map(([exerciseName, sets]) => ({ exerciseName, sets })),
      };
    });
  } catch (e) {
    console.warn("cloud history load failed, using local-only history", e);
    cloudWorkouts = [];
  } finally {
    loaded = true;
    waiters.forEach((cb) => cb());
    waiters = [];
  }
}
