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
  { key: "spinalErectors", label: "Spinal Erectors" },
  { key: "upperTraps", label: "Upper Traps" },
  { key: "middleTraps", label: "Middle Traps" },
  { key: "lowerTraps", label: "Lower Traps" },
  { key: "glutes", label: "Glutes" },
  { key: "hipFlexors", label: "Hip Flexors" },
  { key: "adductors", label: "Adductors" },
  { key: "abductors", label: "Abductors" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "quadriceps", label: "Quadriceps" },
  { key: "calves", label: "Calves" },
];
export const MUSCLE_LABEL = Object.fromEntries(MUSCLES.map((m) => [m.key, m.label]));

// Sub-muscles that roll up into one parent row in the main Muscle Volume
// list (summed, like every other muscle) -- the individual upper/middle/
// lower split is only surfaced on demand (the dashboard's muscle
// click-through detail), not shown by default, since seeing 3 rows for
// "traps" everywhere it'd normally be 1 is more clutter than signal for a
// muscle most people think of as one unit day to day.
export const MUSCLE_GROUPS = [{ key: "traps", label: "Traps", members: ["upperTraps", "middleTraps", "lowerTraps"] }];

export const MOVEMENTS = [
  { key: "verticalPush", label: "Vertical Push" },
  { key: "horizontalPush", label: "Horizontal Push" },
  { key: "verticalPull", label: "Vertical Pull" },
  { key: "horizontalPull", label: "Horizontal Pull" },
  { key: "squat", label: "Squat" },
  { key: "hinge", label: "Hinge" },
  { key: "lunge", label: "Lunge" },
  { key: "core", label: "Core" },
  { key: "isolation", label: "Isolation" },
];
// Isolation is a valid tag (so a bicep curl etc. has somewhere to go) but is
// deliberately excluded from the Movement Pattern Volume breakdown -- it
// covers too wide a range of single-joint work to read as one meaningful
// "pattern" the way squat/hinge/push/pull/core do. Core is its own real
// pattern (plank, dead bug, rotational work) and does show up there.
export const MOVEMENTS_IN_VOLUME = MOVEMENTS.filter((m) => m.key !== "isolation");
export const MOVEMENT_LABEL = Object.fromEntries(MOVEMENTS.map((m) => [m.key, m.label]));

// The major joints worth tracking fatigue on -- deliberately just these
// three (not every joint in the body) since these are the ones that
// actually accumulate meaningful, trackable load across a strength
// program and where "am I piling too much on this" is a real question.
export const JOINTS = [
  { key: "lowBack", label: "Low Back" },
  { key: "knees", label: "Knees" },
  { key: "shoulders", label: "Shoulders" },
];
export const JOINT_LABEL = Object.fromEntries(JOINTS.map((j) => [j.key, j.label]));

// How a set of this exercise gets logged -- determines which fields the Log
// view shows. "weighted" (the default, so it's absent on most entries) is
// weight x reps, same as always. Cardio Machine (distance + time) isn't
// here -- it's already fully covered by FitLog's separate Cardio workout
// type, not a per-exercise thing.
export const METRIC_TYPES = [
  { key: "weighted", label: "Weighted (weight × reps)" },
  { key: "bodyweight", label: "Bodyweight (reps only)" },
  { key: "isometric", label: "Isometric Hold (time only)" },
  { key: "loadedCarry", label: "Loaded Carry (weight × time)" },
];
export const METRIC_TYPE_LABEL = Object.fromEntries(METRIC_TYPES.map((m) => [m.key, m.label]));

// name -> { movement, muscles: { muscleKey: fraction }, athleticism?, jointLoad?, metricType? }
// athleticism (absent = 0) is a per-set credit toward Athleticism, in the
// same "credited sets" spirit as muscle/movement volume above -- not a
// free-floating score. A set of isolation work counts 0; an ordinary
// compound lift counts as a fraction of a set (0.2-0.5, scaled by how
// demanding the lift is); a genuinely explosive/power movement (jumps,
// throws, Olympic lifts -- see the entries below the plain strength list)
// counts as a full set, same value a regular working set gets.
// jointLoad (absent = {}) is a separate per-set weight (0-1, occasionally
// higher) toward each of the three joints above -- how much a set of this
// exercise taxes that joint, regardless of which muscle it's training.
// A leg extension is quad-dominant like a squat, but nowhere near as hard
// on the knee joint itself, which is exactly why this is its own field
// rather than derived from muscles/movement.
export const BUILTIN_EXERCISES = {
  "Barbell Squat": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, abs: 0.5, spinalErectors: 0.5, adductors: 0.5 }, athleticism: 0.5, jointLoad: { knees: 0.8, lowBack: 0.5 } },
  "Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.4 } },
  "Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, spinalErectors: 1, upperBack: 0.5, upperTraps: 0.5, forearms: 0.5 }, athleticism: 0.5, jointLoad: { lowBack: 1, knees: 0.2 } },
  "Overhead Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 }, athleticism: 0.3, jointLoad: { shoulders: 0.9 } },
  "Barbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5, rearDelts: 0.5 }, athleticism: 0.2, jointLoad: { lowBack: 0.4, shoulders: 0.2 } },
  "Pull-Up": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 }, athleticism: 0.3, jointLoad: { shoulders: 0.3 } },
  "Chin-Up": { movement: "verticalPull", muscles: { lats: 1, biceps: 1, upperBack: 0.5 }, athleticism: 0.3, jointLoad: { shoulders: 0.2 } },
  "Push-Up": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.3 }, metricType: "bodyweight" },
  "Dip": { movement: "verticalPush", muscles: { triceps: 1, chest: 0.5, frontDelts: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.4 } },
  "Lat Pulldown": { movement: "verticalPull", muscles: { lats: 1, upperBack: 0.5, biceps: 0.5 }, jointLoad: { shoulders: 0.2 } },
  "Seated Cable Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 }, jointLoad: { shoulders: 0.1 } },
  "Incline Bench Press": { movement: "horizontalPush", muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.4 } },
  "Dumbbell Bench Press": { movement: "horizontalPush", muscles: { chest: 1, triceps: 0.5, frontDelts: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.3 } },
  "Dumbbell Shoulder Press": { movement: "verticalPush", muscles: { frontDelts: 1, middleDelts: 0.5, triceps: 0.5 }, athleticism: 0.2, jointLoad: { shoulders: 0.8 } },
  "Dumbbell Row": { movement: "horizontalPull", muscles: { upperBack: 1, lats: 0.5, biceps: 0.5 }, jointLoad: { lowBack: 0.2, shoulders: 0.1 } },
  "Dumbbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Barbell Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Hammer Curl": { movement: "isolation", muscles: { biceps: 1, forearms: 0.5 } },
  "Tricep Pushdown": { movement: "isolation", muscles: { triceps: 1 } },
  "Skull Crusher": { movement: "isolation", muscles: { triceps: 1 } },
  "Leg Press": { movement: "squat", muscles: { quadriceps: 1, glutes: 0.5, hamstrings: 0.5, adductors: 0.5 }, athleticism: 0.2, jointLoad: { knees: 0.7 } },
  "Leg Curl": { movement: "isolation", muscles: { hamstrings: 1 }, jointLoad: { knees: 0.2 } },
  "Leg Extension": { movement: "isolation", muscles: { quadriceps: 1 }, jointLoad: { knees: 0.6 } },
  "Romanian Deadlift": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, spinalErectors: 0.5 }, athleticism: 0.3, jointLoad: { lowBack: 0.7, knees: 0.1 } },
  "Hip Thrust": { movement: "hinge", muscles: { glutes: 1, hamstrings: 0.5, abductors: 0.5 }, athleticism: 0.3, jointLoad: { lowBack: 0.2 } },
  "Walking Lunge": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, adductors: 0.5, abductors: 0.5, hipFlexors: 0.5 }, athleticism: 0.3, jointLoad: { knees: 0.6, lowBack: 0.2 } },
  "Bulgarian Split Squat": { movement: "lunge", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5, adductors: 0.5, abductors: 0.5 }, athleticism: 0.3, jointLoad: { knees: 0.7 } },
  "Calf Raise": { movement: "isolation", muscles: { calves: 1 }, jointLoad: { knees: 0.1 } },
  "Plank": { movement: "core", muscles: { abs: 1, obliques: 0.5 }, jointLoad: { lowBack: 0.2 }, metricType: "isometric" },
  "Hanging Leg Raise": { movement: "core", muscles: { abs: 1, hipFlexors: 1, obliques: 0.5 }, jointLoad: { shoulders: 0.3, lowBack: 0.1 } },
  "Side Plank": { movement: "core", muscles: { obliques: 1, abs: 0.5 }, jointLoad: { lowBack: 0.1 }, metricType: "isometric" },
  "Bird Dog": { movement: "core", muscles: { lowerBack: 1, abs: 0.5, glutes: 0.5 }, jointLoad: { lowBack: 0.2 } },
  "Sumo Deadlift": { movement: "hinge", muscles: { adductors: 1, glutes: 1, hamstrings: 0.5, spinalErectors: 0.5, quadriceps: 0.5 }, athleticism: 0.5, jointLoad: { lowBack: 0.8, knees: 0.3 } },
  "Hip Adduction Machine": { movement: "isolation", muscles: { adductors: 1 }, jointLoad: { knees: 0.1 } },
  "Hip Abduction Machine": { movement: "isolation", muscles: { abductors: 1 }, jointLoad: { knees: 0.1 } },
  "Standing Cable Hip Flexion": { movement: "isolation", muscles: { hipFlexors: 1 } },
  "Cable Fly": { movement: "horizontalPush", muscles: { chest: 1 }, jointLoad: { shoulders: 0.3 } },
  "Face Pull": { movement: "horizontalPull", muscles: { rearDelts: 1, upperBack: 0.5 }, jointLoad: { shoulders: 0.2 } },
  "Lateral Raise": { movement: "isolation", muscles: { middleDelts: 1 }, jointLoad: { shoulders: 0.4 } },
  "Front Raise": { movement: "isolation", muscles: { frontDelts: 1 }, jointLoad: { shoulders: 0.4 } },
  "Shrug": { movement: "isolation", muscles: { upperTraps: 1 } },
  "Good Morning": { movement: "hinge", muscles: { hamstrings: 1, spinalErectors: 1, glutes: 0.5 }, athleticism: 0.3, jointLoad: { lowBack: 0.9 } },
  "Farmer's Carry": { movement: "isolation", muscles: { forearms: 1, upperTraps: 0.5, abs: 0.5 }, athleticism: 0.5, jointLoad: { lowBack: 0.3, shoulders: 0.2 }, metricType: "loadedCarry" },

  // Explosive/power movements -- jumps, throws, Olympic lifts, and similar.
  // Each one counts as a full set (1, same as compound lifts' 0.2-0.5 caps
  // out below), not a variably-weighted score -- these specifically train
  // power/speed/coordination rather than just moving load, which is
  // credit enough on its own without trying to rank explosive movements
  // against each other. jointLoad still varies per movement though --
  // that tracks joint *stress*, a completely separate question from how
  // much Athleticism credit the set earns.
  "Box Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, calves: 0.5 }, athleticism: 1, jointLoad: { knees: 0.7 } },
  "Broad Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, hamstrings: 0.5 }, athleticism: 1, jointLoad: { knees: 0.6, lowBack: 0.2 } },
  "Depth Jump": { movement: "squat", muscles: { quadriceps: 1, glutes: 1, calves: 0.5 }, athleticism: 1, jointLoad: { knees: 0.9 } },
  "Jump Squat": { movement: "squat", muscles: { quadriceps: 1, glutes: 1 }, athleticism: 1, jointLoad: { knees: 0.7 } },
  "Tuck Jump": { movement: "squat", muscles: { quadriceps: 1, calves: 0.5, abs: 0.5 }, athleticism: 1, jointLoad: { knees: 0.6 } },
  "Medicine Ball Slam": { movement: "isolation", muscles: { abs: 1, obliques: 0.5, lats: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.3, shoulders: 0.3 } },
  "Medicine Ball Chest Throw": { movement: "horizontalPush", muscles: { chest: 1, frontDelts: 0.5, triceps: 0.5 }, athleticism: 1, jointLoad: { shoulders: 0.4 } },
  "Medicine Ball Rotational Throw": { movement: "core", muscles: { obliques: 1, abs: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.3 } },
  "Clean": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, upperTraps: 1, upperBack: 0.5, quadriceps: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.5, knees: 0.4, shoulders: 0.3 } },
  "Snatch": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, upperTraps: 1, frontDelts: 0.5, quadriceps: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.6, knees: 0.4, shoulders: 0.5 } },
  "Clean and Jerk": { movement: "hinge", muscles: { hamstrings: 1, glutes: 1, upperTraps: 1, frontDelts: 0.5, quadriceps: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.6, knees: 0.5, shoulders: 0.5 } },
  "Jerk": { movement: "verticalPush", muscles: { frontDelts: 1, triceps: 0.5, quadriceps: 0.5 }, athleticism: 1, jointLoad: { shoulders: 0.6, knees: 0.3 } },
  "Push Press": { movement: "verticalPush", muscles: { frontDelts: 1, triceps: 0.5, quadriceps: 0.3 }, athleticism: 1, jointLoad: { shoulders: 0.7, knees: 0.2, lowBack: 0.2 } },
  "Kettlebell Swing": { movement: "hinge", muscles: { glutes: 1, hamstrings: 1, spinalErectors: 0.5 }, athleticism: 1, jointLoad: { lowBack: 0.6 } },
  "Sprint": { movement: "isolation", muscles: { quadriceps: 0.5, hamstrings: 1, glutes: 0.5, calves: 0.5 }, athleticism: 1, jointLoad: { knees: 0.4, lowBack: 0.2 } },
  "Burpee": { movement: "isolation", muscles: { chest: 0.5, quadriceps: 0.5, abs: 0.5 }, athleticism: 1, jointLoad: { knees: 0.3, shoulders: 0.2, lowBack: 0.2 } },
  "Battle Ropes": { movement: "isolation", muscles: { frontDelts: 0.5, abs: 0.5, forearms: 0.5 }, athleticism: 1, jointLoad: { shoulders: 0.5 } },
};

export const EMPTY_META = { movement: "isolation", muscles: {}, athleticism: 0, jointLoad: {}, metricType: "weighted" };
