const MUSCLE_ALIASES = {
  chest: ["chest", "胸"],
  back: ["back", "背"],
  shoulders: ["shoulder", "肩"],
  biceps: ["biceps", "二头"],
  triceps: ["triceps", "三头"],
  core: ["core", "abs", "腹", "核心"],
  glutes: ["glute", "臀"],
  quads: ["quad", "股四头"],
  hamstrings: ["hamstring", "腘绳"],
  calves: ["calf", "calves", "小腿"],
  fullBody: ["full body", "全身"]
};

const MODEL_MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "core",
  "glutes",
  "quads",
  "hamstrings",
  "calves"
];

export function buildTrainingComparison({
  date,
  trainingSessions = [],
  preferredExercise = "",
  preferredMuscleGroup = ""
} = {}) {
  const sessions = trainingSessions.filter(
    (session) => isStrength(session) && session.date && session.date <= date
  );
  const sameDay = sessions
    .filter((session) => session.date === date)
    .sort((a, b) => recordOrder(b).localeCompare(recordOrder(a)));
  const selected = sameDay.flatMap((session) => session.exercises || [])[0] || null;
  const exerciseName = selected?.name || preferredExercise;
  const muscleGroup = selected?.muscleGroup || preferredMuscleGroup;
  const canonicalMuscle = canonicalMuscleGroup(muscleGroup);

  if (!exerciseName) {
    return { exerciseName: "", muscleGroup: "", points: [] };
  }

  const points = sessions
    .flatMap((session) =>
      (session.exercises || [])
        .filter(
          (exercise) =>
            exercise.name === exerciseName &&
            (!canonicalMuscle || canonicalMuscleGroup(exercise.muscleGroup) === canonicalMuscle)
        )
        .map((exercise) => buildComparisonPoint(session, exercise))
    )
    .sort((a, b) => a.order.localeCompare(b.order))
    .slice(-5)
    .map(({ order, ...point }) => point);

  return { exerciseName, muscleGroup, points };
}

export function buildMuscleRecency({ date, trainingSessions = [] } = {}) {
  const lastTrained = {};
  for (const session of trainingSessions) {
    if (!isStrength(session) || !session.date || session.date > date) continue;
    for (const exercise of session.exercises || []) {
      const muscle = canonicalMuscleGroup(exercise.muscleGroup);
      const targets = muscle === "fullBody" ? MODEL_MUSCLES : [muscle];
      for (const target of targets) {
        if (!target) continue;
        if (!lastTrained[target] || session.date > lastTrained[target]) {
          lastTrained[target] = session.date;
        }
      }
    }
  }

  return Object.fromEntries(
    MODEL_MUSCLES.map((muscle) => {
      const lastDate = lastTrained[muscle] || null;
      const daysAgo = lastDate ? daysBetween(lastDate, date) : null;
      return [muscle, { lastDate, daysAgo, state: recencyState(daysAgo) }];
    })
  );
}

export function canonicalMuscleGroup(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "腿") return "quads";
  for (const [muscle, aliases] of Object.entries(MUSCLE_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return muscle;
  }
  return normalized;
}

function buildComparisonPoint(session, exercise) {
  const sets = exercise.sets || [];
  return {
    date: session.date,
    maxWeight: sets.reduce((max, set) => Math.max(max, Number(set.weight) || 0), 0),
    volume: sets.reduce(
      (total, set) => total + (Number(set.weight) || 0) * (Number(set.reps) || 0),
      0
    ),
    setCount: sets.length,
    order: recordOrder(session)
  };
}

function recordOrder(record) {
  return `${record.date || ""}|${record.updatedAt || ""}|${record.id || ""}`;
}

function isStrength(session) {
  return Boolean(
    session &&
      (session.category === "strength" ||
        session.activityType === "strength" ||
        session.exercises?.length)
  );
}

function daysBetween(from, to) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function recencyState(daysAgo) {
  if (daysAgo === null || daysAgo >= 7) return "attention";
  if (daysAgo <= 1) return "recent";
  if (daysAgo <= 3) return "warm";
  return "neutral";
}
