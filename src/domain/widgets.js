export function isGoalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function mergeCompletionDates(...dateLists) {
  return [...new Set(dateLists.flatMap((dates) => Array.isArray(dates) ? dates.filter(isGoalDate) : []))].sort();
}

export function buildWidgetSnapshot({ settings = {}, trainingSessions = [], today } = {}) {
  const date = today || localToday();
  const title = settings.preferredExercise || "设置训练目标";
  const target = Math.max(0, Number(settings.weightGoalKg) || 0);
  const maxWeight = trainingSessions
    .filter((session) => session.date === date && !session.deletedAt && session.category !== "duration")
    .flatMap((session) => session.exercises || [])
    .filter((exercise) => exercise.name === settings.preferredExercise)
    .flatMap((exercise) => exercise.sets || [])
    .reduce((maximum, set) => Math.max(maximum, Number(set.weight) || 0), 0);
  return {
    date,
    title,
    detail: [settings.preferredMuscleGroup, target > 0 ? `${target} kg` : "目标重量待设置"].filter(Boolean).join(" · "),
    progress: target > 0 ? Math.min(1, Math.max(0, maxWeight / target)) : 0,
    completionDates: mergeCompletionDates(settings.goalCompletionDates)
  };
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
