import { addDays, aggregateDailyNutrition } from "./nutrition.js";
import { summarizeTrainingForDate } from "./training.js";

export function buildDailySummary({ date, foodEntries, trainingSessions }) {
  const nutrition = aggregateDailyNutrition(foodEntries, date);
  const training = summarizeTrainingForDate(trainingSessions, date);
  return {
    date,
    nutrition,
    training,
    netCalories: Math.round(nutrition.calories - training.calories)
  };
}

export function buildWeeklyReport({ weekStart, foodEntries, trainingSessions }) {
  const days = Array.from({ length: 7 }, (_, index) =>
    buildDailySummary({
      date: addDays(weekStart, index),
      foodEntries,
      trainingSessions
    })
  );

  return {
    weekStart,
    days,
    series: {
      dates: days.map((day) => day.date),
      calorieIntake: days.map((day) => day.nutrition.calories),
      trainingCalories: days.map((day) => day.training.calories),
      netCalories: days.map((day) => day.netCalories),
      protein: days.map((day) => day.nutrition.protein),
      strengthVolume: days.map((day) => day.training.strengthVolume),
      aerobicDistance: days.map((day) => day.training.distanceKm)
    }
  };
}
