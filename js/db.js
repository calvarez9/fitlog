// ---------- Local-first storage layer ----------
// Everything lives in localStorage as plain JSON. No server, no accounts.

const KEYS = {
  workouts: "fitlog_workouts",
  routines: "fitlog_routines",
  exercises: "fitlog_custom_exercises",
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
const DEFAULT_SETTINGS = { unit: "lb", restTimerDefault: 90 };

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}
export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}

// ---------- Exercises ----------
const BUILTIN_EXERCISES = [
  "Barbell Squat", "Bench Press", "Deadlift", "Overhead Press", "Barbell Row",
  "Pull-Up", "Chin-Up", "Push-Up", "Dip", "Lat Pulldown", "Seated Cable Row",
  "Incline Bench Press", "Dumbbell Bench Press", "Dumbbell Shoulder Press",
  "Dumbbell Row", "Dumbbell Curl", "Barbell Curl", "Hammer Curl",
  "Tricep Pushdown", "Skull Crusher", "Leg Press", "Leg Curl", "Leg Extension",
  "Romanian Deadlift", "Hip Thrust", "Walking Lunge", "Bulgarian Split Squat",
  "Calf Raise", "Plank", "Hanging Leg Raise", "Cable Fly", "Face Pull",
  "Lateral Raise", "Front Raise", "Shrug", "Good Morning", "Farmer's Carry",
];

export function getExercises() {
  const custom = read(KEYS.exercises, []);
  const all = [...new Set([...BUILTIN_EXERCISES, ...custom])];
  return all.sort((a, b) => a.localeCompare(b));
}

export function addCustomExercise(name) {
  name = name.trim();
  if (!name) return;
  if (getExercises().some((e) => e.toLowerCase() === name.toLowerCase())) return;
  const custom = read(KEYS.exercises, []);
  custom.push(name);
  write(KEYS.exercises, custom);
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
  return workout;
}

export function deleteWorkout(id) {
  const all = read(KEYS.workouts, []).filter((w) => w.id !== id);
  write(KEYS.workouts, all);
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
    settings: read(KEYS.settings, {}),
  };
}

export function importAll(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup file");
  if (Array.isArray(data.workouts)) write(KEYS.workouts, data.workouts);
  if (Array.isArray(data.routines)) write(KEYS.routines, data.routines);
  if (Array.isArray(data.exercises)) write(KEYS.exercises, data.exercises);
  if (data.settings && typeof data.settings === "object") write(KEYS.settings, data.settings);
}

export function clearAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export { uid };
