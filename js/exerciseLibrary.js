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
  { key: "obliques", label: "Obliques" },
  { key: "lats", label: "Lats" },
  { key: "upperBack", label: "Upper Back" },
  { key: "lowerBack", label: "Lower Back" },
  { key: "traps", label: "Traps" },
  { key: "glutes", label: "Glutes" },
  { key: "hipFlexors", label: "Hip Flexors" },
  { key: "adductors", label: "Adductors" },
  { key: "abductors", label: "Abductors" },
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

// name -> { movement, muscles: { muscleKey: fraction }, athleticism? }
// athleticism (absent = 0) is a per-set weight toward a training-emphasis
// score, separate from movement/muscle credit: ordinary compound lifts get
// a modest 0.2-0.4 (they build some general athletic capacity but aren't
// explosive); genuinely explosive/power movements (jumps, throws, Olympic
// lifts) are weighted far higher -- see the entries below the plain
// strength list. Isolation work stays at 0 (unset).
export const BUILTIN_EXERCISES = {
  "Barbell Squat": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, abs: 0.5, lowerBack: 0.5, adductors: 0.5 }, athleticism: 0.4 },
  "Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2 },
  "Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, lowerBack: 1, upperBack: 0.5, traps: 0.5, forearms: 0.5 }, athleticism: 0.4 },
  "Overhead Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 }, athleticism: 0.3 },
  "Barbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5, rearDelts: 0.5 }, athleticism: 0.2 },
  "Pull-Up": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 }, athleticism: 0.3 },
  "Chin-Up": { movement: "verticalPull", muscles: { lats: 1, biceps: 1, upperBack: 0.5 }, athleticism: 0.3 },
  "Push-Up": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2 },
  "Dip": { movement: "verticalPush", muscles: { triceps: 1, chest: 0.5, frontDelts: 0.5 }, athleticism: 0.2 },
  "Lat Pulldown": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 } },
  "Seated Cable Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 } },
  "Incline Bench Press": { movement: "horizontalPush", muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 }, athleticism: 0.2 },
  "Dumbbell Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2 },
  "Dumbbell Shoulder Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 }, athleticism: 0.2 },
  "Dumbbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 } },
  "Dumbbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Barbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Hammer Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Tricep Pushdown": { movement: "isolation", muscles: { triceps: 1 } },
  "Skull Crusher": { movement: "isolation", muscles: { triceps: 1 } },
  "Leg Press": { movement: "squat", muscles: { quadriceps: 1, glutes: 0.5, hamstrings: 0.5, adductors: 0.5 }, athleticism: 0.2 },
  "Leg Curl": { movement: "isolation", muscles: { hamstrings: 1 } },
  "Leg Extension": { movement: "isolation", muscles: { quadriceps: 1 } },
  "Romanian Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, lowerBack: 0.5 }, athleticism: 0.3 },
  "Hip Thrust": { movement: "hinge", muscles: { glutes: 1, hamstrings: 0.5, abductors: 0.5 }, athleticism: 0.3 },
  "Walking Lunge": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, adductors: 0.5, abductors: 0.5, hipFlexors: 0.5 }, athleticism: 0.3 },
  "Bulgarian Split Squat": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, adductors: 0.5, abductors: 0.5 }, athleticism: 0.3 },
  "Calf Raise": { movement: "isolation", muscles: { calves: 1 } },
  "Plank": { movement: "isolation", muscles: { abs: 1, obliques: 0.5 } },
  "Hanging Leg Raise": { movement: "isolation", muscles: { abs: 1, hipFlexors: 1, obliques: 0.5 } },
  "Side Plank": { movement: "isolation", muscles: { obliques: 1, abs: 0.5 } },
  "Bird Dog": { movement: "isolation", muscles: { lowerBack: 1, abs: 0.5, glutes: 0.5 } },
  "Sumo Deadlift": { movement: "hinge", muscles: { adductors: 1, glutes: 1, hamstrings: 0.5, lowerBack: 0.5, quadriceps: 0.5 }, athleticism: 0.4 },
  "Hip Adduction Machine": { movement: "isolation", muscles: { adductors: 1 } },
  "Hip Abduction Machine": { movement: "isolation", muscles: { abductors: 1 } },
  "Standing Cable Hip Flexion": { movement: "isolation", muscles: { hipFlexors: 1 } },
  "Cable Fly": { movement: "horizontalPush", muscles: { chest: 1 } },
  "Face Pull": { movement: "horizontalPull", muscles: { rearDelts: 1, upperBack: 0.5 } },
  "Lateral Raise": { movement: "isolation", muscles: { middleDelts: 1 } },
  "Front Raise": { movement: "isolation", muscles: { frontDelts: 1 } },
  "Shrug": { movement: "isolation", muscles: { traps: 1 } },
  "Good Morning": { movement: "hinge", muscles: { hamstrings: 1, lowerBack: 1, glutes: 0.5 }, athleticism: 0.3 },
  "Farmer's Carry": { movement: "isolation", muscles: { forearms: 1, traps: 0.5, abs: 0.5 }, athleticism: 0.4 },

  // Explosive/power movements -- jumps, throws, Olympic lifts, and similar.
  // Weighted well above the compound-lift range (1.0-2.0/set) since these
  // specifically train power/speed/coordination rather than just moving load.
  "Box Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, calves: 0.5 }, athleticism: 1.5 },
  "Broad Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5 }, athleticism: 1.5 },
  "Depth Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, calves: 0.5 }, athleticism: 1.8 },
  "Jump Squat": { movement: "squat", muscles: { quadriceps: 1, glutes: 1 }, athleticism: 1.2 },
  "Tuck Jump": { movement: "squat", muscles: { quadriceps: 1, calves: 0.5, abs: 0.5 }, athleticism: 1.3 },
  "Medicine Ball Slam": { movement: "isolation", muscles: { abs: 1, obliques: 0.5, lats: 0.5 }, athleticism: 1.3 },
  "Medicine Ball Chest Throw": { movement: "horizontalPush", muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 }, athleticism: 1.3 },
  "Medicine Ball Rotational Throw": { movement: "isolation", muscles: { obliques: 1, abs: 0.5 }, athleticism: 1.3 },
  "Clean": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, traps: 1, upperBack: 0.5, quadriceps: 0.5 }, athleticism: 1.8 },
  "Snatch": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, traps: 1, frontDelts: 0.5, quadriceps: 0.5 }, athleticism: 2 },
  "Clean and Jerk": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, traps: 1, frontDelts: 0.5, quadriceps: 0.5 }, athleticism: 2 },
  "Jerk": { movement: "verticalPush", muscles: { frontDelts: 1, triceps: 0.5, quadriceps: 0.5 }, athleticism: 1.8 },
  "Push Press": { movement: "verticalPush", muscles: { frontDelts: 1, triceps: 0.5, quadriceps: 0.3 }, athleticism: 1 },
  "Kettlebell Swing": { movement: "hinge", muscles: { glutes: 1, hamstrings: 1, lowerBack: 0.5 }, athleticism: 1 },
  "Sprint": { movement: "isolation", muscles: { quadriceps: 0.5, hamstrings: 1, glutes: 0.5, calves: 0.5 }, athleticism: 1.5 },
  "Burpee": { movement: "isolation", muscles: { chest: 0.5, quadriceps: 0.5, abs: 0.5 }, athleticism: 1 },
  "Battle Ropes": { movement: "isolation", muscles: { frontDelts: 0.5, abs: 0.5, forearms: 0.5 }, athleticism: 1 },
};

export const EMPTY_META = { movement: "isolation", muscles: {}, athleticism: 0 };
