// ---------- Local-first storage layer ----------
// Everything lives in localStorage as plain JSON -- reads/writes here never
// touch the network. A best-effort background sync layer (sync.js) queues
// every save/delete for push to the Fitness Dashboard once signed in; see
// the queue* calls below and js/sync.js for how that works.
import { queueWorkoutSync, queueWorkoutDelete, queueExerciseSync, queueExerciseDelete } from "./sync.js";

const KEYS = {
  workouts: "fitlog_workouts",
  routines: "fitlog_routines",
  exercises: "fitlog_custom_exercises",
  cardioTypes: "fitlog_custom_cardio_types",
  settings: "fitlog_settings",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Failed to read", key, e);
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Settings ----------
const DEFAULT_SETTINGS = { unit: "lb", distanceUnit: "mi" };

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}
export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}

// ---------- Exercises ----------
// Custom exercises (and overrides of builtins) are stored as an array of
// { name, movement, muscles: {muscleKey: fraction} }. A legacy install may
// still have plain strings here from before metadata existed — normalized
// to a minimal object on read.
import { BUILTIN_EXERCISES, EMPTY_META } from "./exerciseLibrary.js";

function normalizeCustom(entry) {
  if (typeof entry === "string") return { name: entry, ...EMPTY_META, muscles: {} };
  return entry;
}

export function getCustomExerciseObjects() {
  return read(KEYS.exercises, []).map(normalizeCustom);
}

// All exercise names (builtin + custom), for pickers/datalists.
export function getExercises() {
  const custom = getCustomExerciseObjects().map((e) => e.name);
  const all = [...new Set([...Object.keys(BUILTIN_EXERCISES), ...custom])];
  return all.sort((a, b) => a.localeCompare(b));
}

// Full { name, movement, muscles, athleticism, jointLoad, isCustom, isOverride } for every known exercise.
export function getAllExerciseObjects() {
  const customByName = new Map(getCustomExerciseObjects().map((e) => [e.name, e]));
  const names = getExercises();
  return names.map((name) => {
    const custom = customByName.get(name);
    const builtin = BUILTIN_EXERCISES[name];
    if (custom) return { name, movement: custom.movement, muscles: custom.muscles, athleticism: custom.athleticism || 0, jointLoad: custom.jointLoad || {}, isCustom: !builtin, isOverride: !!builtin, createdAt: custom.createdAt || 0 };
    return { name, movement: builtin.movement, muscles: builtin.muscles, athleticism: builtin.athleticism || 0, jointLoad: builtin.jointLoad || {}, isCustom: false, isOverride: false, createdAt: 0 };
  });
}

// Metadata for a single exercise name, with graceful fallback for unknown names.
export function getExerciseMeta(name) {
  const custom = getCustomExerciseObjects().find((e) => e.name === name);
  if (custom) return { movement: custom.movement, muscles: custom.muscles, athleticism: custom.athleticism || 0, jointLoad: custom.jointLoad || {} };
  if (BUILTIN_EXERCISES[name]) return BUILTIN_EXERCISES[name];
  return EMPTY_META;
}

// Quick-add from the Log view: name only, no metadata yet.
export function addCustomExercise(name) {
  name = name.trim();
  if (!name) return;
  if (getExercises().some((e) => e.toLowerCase() === name.toLowerCase())) return;
  const custom = read(KEYS.exercises, []);
  custom.push({ name, ...EMPTY_META, muscles: {}, createdAt: Date.now() });
  write(KEYS.exercises, custom);
  queueExerciseSync(name);
}

// Full add/edit from the Exercise Library: name + movement + muscles + athleticism + jointLoad.
// Saving under a name that matches a builtin creates an override. createdAt
// is set once on first creation and carried forward on every edit after
// that -- it's what "Recently Added" sorts by, so an edit shouldn't bump an
// exercise back to the top as if it were new.
export function saveCustomExercise({ name, movement, muscles, athleticism, jointLoad }, originalName = null) {
  name = name.trim();
  if (!name) throw new Error("Name required");
  const all = read(KEYS.exercises, []).map(normalizeCustom);
  const targetName = originalName || name;
  const idx = all.findIndex((e) => e.name === targetName);
  const createdAt = idx >= 0 ? all[idx].createdAt || Date.now() : Date.now();
  const entry = { name, movement, muscles, athleticism: athleticism || 0, jointLoad: jointLoad || {}, createdAt };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  write(KEYS.exercises, all);
  if (originalName && originalName !== name) queueExerciseDelete(originalName);
  queueExerciseSync(name);
  return entry;
}

// Deletes a custom exercise / override. If it was overriding a builtin,
// this reverts it back to the builtin default (rather than losing it).
export function deleteCustomExercise(name) {
  const all = read(KEYS.exercises, []).map(normalizeCustom).filter((e) => e.name !== name);
  write(KEYS.exercises, all);
  queueExerciseDelete(name);
}

// ---------- Cardio activity types ----------
import { BUILTIN_CARDIO_TYPES } from "./cardioLibrary.js";

export function getCardioTypes() {
  const custom = read(KEYS.cardioTypes, []);
  const all = [...new Set([...BUILTIN_CARDIO_TYPES, ...custom])];
  // Keep "Other" last rather than alphabetizing it away from the end.
  return [...all.filter((t) => t !== "Other").sort((a, b) => a.localeCompare(b)), "Other"];
}

export function addCustomCardioType(name) {
  name = name.trim();
  if (!name) return;
  if (getCardioTypes().some((t) => t.toLowerCase() === name.toLowerCase())) return;
  const custom = read(KEYS.cardioTypes, []);
  custom.push(name);
  write(KEYS.cardioTypes, custom);
}

// ---------- Workouts ----------
export function getWorkouts() {
  return read(KEYS.workouts, []).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getWorkout(id) {
  return getWorkouts().find((w) => w.id === id) || null;
}

export function saveWorkout(workout) {
  const all = read(KEYS.workouts, []);
  if (!workout.id) workout.id = uid();
  const idx = all.findIndex((w) => w.id === workout.id);
  if (idx >= 0) all[idx] = workout;
  else all.push(workout);
  write(KEYS.workouts, all);
  queueWorkoutSync(workout.id);
  return workout;
}

export function deleteWorkout(id) {
  const all = read(KEYS.workouts, []).filter((w) => w.id !== id);
  write(KEYS.workouts, all);
  queueWorkoutDelete(id);
}

// ---------- Routines ----------
export function getRoutines() {
  return read(KEYS.routines, []);
}

export function saveRoutine(routine) {
  const all = read(KEYS.routines, []);
  if (!routine.id) routine.id = uid();
  const idx = all.findIndex((r) => r.id === routine.id);
  if (idx >= 0) all[idx] = routine;
  else all.push(routine);
  write(KEYS.routines, all);
  return routine;
}

export function deleteRoutine(id) {
  const all = read(KEYS.routines, []).filter((r) => r.id !== id);
  write(KEYS.routines, all);
}

// ---------- Backup / restore ----------
export function exportAll() {
  return {
    schema: 1,
    exportedAt: new Date().toISOString(),
    workouts: read(KEYS.workouts, []),
    routines: read(KEYS.routines, []),
    exercises: read(KEYS.exercises, []),
    cardioTypes: read(KEYS.cardioTypes, []),
    settings: read(KEYS.settings, {}),
  };
}

export function importAll(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  if (Array.isArray(data.workouts)) write(KEYS.workouts, data.workouts);
  if (Array.isArray(data.routines)) write(KEYS.routines, data.routines);
  if (Array.isArray(data.exercises)) write(KEYS.exercises, data.exercises);
  if (Array.isArray(data.cardioTypes)) write(KEYS.cardioTypes, data.cardioTypes);
  if (data.settings && typeof data.settings === "object") write(KEYS.settings, data.settings);
}

export function clearAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export { uid };
