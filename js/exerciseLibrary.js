// ---------- Exercise metadata: muscles + movement patterns ----------
// Each exercise maps to a movement pattern and a set of muscles with a
// fractional credit (1.0 = primary mover, 0.5 = secondary/assisting).
// Used to roll logged sets up into muscle-engagement & movement-pattern volume.

export const MUSCLES = [
  { key: "frontDelts", label: "Front Delts" },
  { key: "middleDelts", label: "Middle Delts" },
  { key: "rearDelts", label: "Rear Delts" },
  { key: "chest", label: "Chest" },
  { key: "triceps", label: "Triceps" },
  { key: "biceps", label: "Biceps" },
  { key: "forearms", label: "Forearms" },
  { key: "abs", label: "Abs" },
  { key: "lats", label: "Lats" },
  { key: "upperBack", label: "Upper Back" },
  { key: "lowerBack", label: "Lower Back" },
  { key: "traps", label: "Traps" },
  { key: "glutes", label: "Glutes" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "quadriceps", label: "Quadriceps" },
  { key: "calves", label: "Calves" },
];
export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map((m) => [m.key, m.label]));

export const MOVEMENTS = [
  { key: "verticalPush", label: "Vertical Push" },
  { key: "horizontalPush", label: "Horizontal Push" },
  { key: "verticalPull", label: "Vertical Pull" },
  { key: "horizontalPull", label: "Horizontal Pull" },
  { key: "squat", label: "Squat" },
  { key: "hinge", label: "Hinge" },
  { key: "lunge", label: "Lunge" },
  { key: "isolation", label: "Isolation / Core" },
];
export const MOVEMENT_LABEL = Object.fromEntries(MOVEMENTS.map((m) => [m.key, m.label]));

// name -> { movement, muscles: { muscleKey: fraction } }
export const BUILTIN_EXERCISES = {
  "Barbell Squat": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, abs: 0.5, lowerBack: 0.5 } },
  "Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  "Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, lowerBack: 1, upperBack: 0.5, traps: 0.5, forearms: 0.5 } },
  "Overhead Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 } },
  "Barbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5, rearDelts: 0.5 } },
  "Pull-Up": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 } },
  "Chin-Up": { movement: "verticalPull", muscles: { lats: 1, biceps: 1, upperBack: 0.5 } },
  "Push-Up": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  "Dip": { movement: "verticalPush", muscles: { triceps: 1, chest: 0.5, frontDelts: 0.5 } },
  "Lat Pulldown": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 } },
  "Seated Cable Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 } },
  "Incline Bench Press": { movement: "horizontalPush", muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 } },
  "Dumbbell Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 } },
  "Dumbbell Shoulder Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 } },
  "Dumbbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 } },
  "Dumbbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Barbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Hammer Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Tricep Pushdown": { movement: "isolation", muscles: { triceps: 1 } },
  "Skull Crusher": { movement: "isolation", muscles: { triceps: 1 } },
  "Leg Press": { movement: "squat", muscles: { quadriceps: 1, glutes: 0.5, hamstrings: 0.5 } },
  "Leg Curl": { movement: "isolation", muscles: { hamstrings: 1 } },
  "Leg Extension": { movement: "isolation", muscles: { quadriceps: 1 } },
  "Romanian Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, lowerBack: 0.5 } },
  "Hip Thrust": { movement: "hinge", muscles: { glutes: 1, hamstrings: 0.5 } },
  "Walking Lunge": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5 } },
  "Bulgarian Split Squat": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5 } },
  "Calf Raise": { movement: "isolation", muscles: { calves: 1 } },
  "Plank": { movement: "isolation", muscles: { abs: 1 } },
  "Hanging Leg Raise": { movement: "isolation", muscles: { abs: 1 } },
  "Cable Fly": { movement: "horizontalPush", muscles: { chest: 1 } },
  "Face Pull": { movement: "horizontalPull", muscles: { rearDelts: 1, upperBack: 0.5 } },
  "Lateral Raise": { movement: "isolation", muscles: { middleDelts: 1 } },
  "Front Raise": { movement: "isolation", muscles: { frontDelts: 1 } },
  "Shrug": { movement: "isolation", muscles: { traps: 1 } },
  "Good Morning": { movement: "hinge", muscles: { hamstrings: 1, lowerBack: 1, glutes: 0.5 } },
  "Farmer's Carry": { movement: "isolation", muscles: { forearms: 1, traps: 0.5, abs: 0.5 } },
};

export const EMPTY_META = { movement: "isolation", muscles: {} };
