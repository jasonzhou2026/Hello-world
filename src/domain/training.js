const MET_TABLE = {
  strength: { light: 3.5, moderate: 5, hard: 6 },
  running: { light: 7, moderate: 8, hard: 11 },
  cycling: { light: 5, moderate: 7, hard: 10 },
  walking: { light: 3, moderate: 4, hard: 5 },
  hiking: { light: 5, moderate: 6, hard: 8 },
  hiit: { light: 6, moderate: 8, hard: 10 },
  yoga: { light: 2.5, moderate: 3, hard: 4 },
  mobility: { light: 2, moderate: 2.5, hard: 3 },
  swimming: { light: 6, moderate: 8, hard: 10 },
  rowing: { light: 5, moderate: 7, hard: 9 },
  other: { light: 3, moderate: 5, hard: 7 }
};

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateStrengthVolume(sets = []) {
  return roundMetric(
    sets.reduce((total, set) => {
      return total + (Number(set.reps) || 0) * (Number(set.weight) || 0);
    }, 0)
  );
}

export function getMet(activityType = "other", intensity = "moderate") {
  const row = MET_TABLE[activityType] || MET_TABLE.other;
  return row[intensity] || row.moderate;
}

export function calculateTrainingCalories(session) {
  const activityType = session.activityType || session.category || "other";
  const intensity = session.intensity || "moderate";
  const met = getMet(activityType, intensity);
  const bodyWeightKg = Number(session.bodyWeightKg) || 70;
  const durationHours = (Number(session.durationMinutes) || 0) / 60;
  return Math.round(met * bodyWeightKg * durationHours);
}

export function summarizeTrainingForDate(sessions, date) {
  return sessions
    .filter((session) => session.date === date)
    .reduce(
      (summary, session) => {
        const exercises = session.exercises || [];
        const sets = exercises.flatMap((exercise) => exercise.sets || []);
        summary.strengthVolume += calculateStrengthVolume(sets);
        summary.totalSets += sets.length;
        summary.durationMinutes += Number(session.durationMinutes) || 0;
        if (!exercises.length && session.activityType !== "strength") {
          summary.aerobicDurationMinutes += Number(session.durationMinutes) || 0;
        }
        summary.distanceKm += Number(session.distanceKm) || 0;
        summary.calories += calculateTrainingCalories(session);
        return summary;
      },
      {
        strengthVolume: 0,
        totalSets: 0,
        durationMinutes: 0,
        aerobicDurationMinutes: 0,
        distanceKm: 0,
        calories: 0
      }
    );
}
