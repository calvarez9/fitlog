// ---------- Weekly muscle & movement-pattern volume ----------
import { getExerciseMeta } from "./db.js";
import { MUSCLES, MOVEMENTS, MOVEMENT_LABEL } from "./exerciseLibrary.js";

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getWeekRange(offset = 0) {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  end.setHours(23, 59, 59, 999);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
}

// workouts: array from db.getWorkouts(). Returns sets-per-muscle and sets-per-movement
// for workouts whose date falls within [start, end], plus a Strength/
// Athleticism/Cardio breakdown for the same range (three numbers in their
// own native units -- sets / weighted score / minutes -- same reasoning
// as the dashboard's Training Emphasis: forcing them onto one shared
// scale would be more misleading than honest).
export function computeVolume(workouts, { start, end }) {
  const muscleTotals = Object.fromEntries(MUSCLES.map((m) => [m.key, 0]));
  const movementTotals = Object.fromEntries(MOVEMENTS.map((m) => [m.key, 0]));
  let strengthSets = 0;
  let athleticismScore = 0;
  let cardioMinutes = 0;

  workouts
    .filter((w) => {
      const d = new Date(w.date);
      return d >= start && d <= end;
    })
    .forEach((w) => {
      if (w.type === "cardio") {
        (w.segments || []).forEach((seg) => {
          cardioMinutes += seg.durationMin || 0;
        });
        return;
      }
      w.exercises.forEach((ex) => {
        const setCount = ex.sets.filter((s) => !s.isWarmup).length;
        if (!setCount) return;
        strengthSets += setCount;
        const meta = getExerciseMeta(ex.exerciseName);
        athleticismScore += setCount * (meta.athleticism || 0);
        movementTotals[meta.movement] = (movementTotals[meta.movement] || 0) + setCount;
        Object.entries(meta.muscles || {}).forEach(([muscle, frac]) => {
          muscleTotals[muscle] = (muscleTotals[muscle] || 0) + setCount * frac;
        });
      });
    });

  const muscleRows = MUSCLES.map((m) => ({ key: m.key, label: m.label, sets: round(muscleTotals[m.key]) }))
    .filter((r) => r.sets > 0)
    .sort((a, b) => b.sets - a.sets);

  const movementRows = MOVEMENTS.map((m) => ({ key: m.key, label: MOVEMENT_LABEL[m.key], sets: round(movementTotals[m.key]) }))
    .filter((r) => r.sets > 0)
    .sort((a, b) => b.sets - a.sets);

  return {
    muscleRows,
    movementRows,
    muscleTotals,
    movementTotals,
    strengthSets,
    athleticismScore: round(athleticismScore),
    cardioMinutes: Math.round(cardioMinutes),
  };
}

function round(n) {
  return Math.round(n * 2) / 2; // nearest 0.5
}
