// ---------- Exercise name matching, tolerant of equipment suffixes ----------
// bestSetFor()/recentPerformancesFor() compare exercise names to decide
// whether a past session counts toward the one you're currently logging.
// That's a plain string comparison, which works fine for anything typed
// directly in FitLog -- but cloud history (cloudHistory.js) also brings in
// Boostcamp's naming convention, which tags nearly everything with its
// equipment ("Bench Press (Barbell)", "Chest Supported Row (Machine)").
// Typing FitLog's own plain "Bench Press" would never match those without
// this -- ported from the Fitness Dashboard's own exerciseLibrary.js
// (resolveExerciseMeta), which solves the exact same problem for the same
// Boostcamp data, so a name that resolves there resolves the same way here.
function stripEquipmentSuffix(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function normKey(name) {
  return name.trim().toLowerCase();
}

// Renames whose stripped form still doesn't match the other side directly
// (equipment variant, alternate phrasing). Kept in sync with the
// dashboard's own ALIASES table -- same source data, same names to solve.
const ALIASES = {
  "wide grip lat pulldown": "Lat Pulldown",
  "b-stance romanian deadlift": "Romanian Deadlift",
  "bicep curl": "Dumbbell Curl",
  "leg raise": "Hanging Leg Raise",
  "reverse lunge": "Walking Lunge",
  "seated shoulder press": "Dumbbell Shoulder Press",
  "single leg calf raise": "Calf Raise",
  "push up": "Push-Up",
  "standing shoulder press": "Dumbbell Shoulder Press",
  "hang clean": "Clean",
  "power clean": "Clean",
  "squat clean": "Clean",
  "hang snatch": "Snatch",
  "power snatch": "Snatch",
  "split jerk": "Jerk",
  "push jerk": "Jerk",
  "sprints": "Sprint",
  "burpees": "Burpee",
  "med ball slam": "Medicine Ball Slam",
  "wall ball": "Medicine Ball Chest Throw",
};

function canonicalKey(name) {
  const stripped = stripEquipmentSuffix(name);
  const key = normKey(stripped);
  return normKey(ALIASES[key] || stripped);
}

export function namesMatch(a, b) {
  if (!a || !b) return false;
  return canonicalKey(a) === canonicalKey(b);
}
