export const NUTRIENT_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "sodium",
  "calcium",
  "iron",
  "magnesium",
  "potassium",
  "zinc",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminB12"
];

export function emptyNutritionTotals() {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));
}

export function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateFoodEntryNutrition(entry) {
  const grams = Number(entry.grams) || 0;
  const source = entry.nutrientsPer100g || {};
  const totals = emptyNutritionTotals();

  for (const key of NUTRIENT_KEYS) {
    totals[key] = roundMetric(((Number(source[key]) || 0) * grams) / 100);
  }

  return { ...entry, totals };
}

export function addNutritionTotals(a, b) {
  const totals = emptyNutritionTotals();
  for (const key of NUTRIENT_KEYS) {
    totals[key] = (Number(a[key]) || 0) + (Number(b[key]) || 0);
  }
  return totals;
}

export function aggregateDailyNutrition(entries, date) {
  const rawTotals = entries
    .filter((entry) => entry.date === date)
    .reduce((totals, entry) => {
      const grams = Number(entry.grams) || 0;
      const source = entry.nutrientsPer100g || {};

      for (const key of NUTRIENT_KEYS) {
        totals[key] += ((Number(source[key]) || 0) * grams) / 100;
      }

      return totals;
    }, emptyNutritionTotals());

  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, roundMetric(rawTotals[key])]));
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function aggregateWeeklyNutrition(entries, weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return { date, totals: aggregateDailyNutrition(entries, date) };
  });
}
