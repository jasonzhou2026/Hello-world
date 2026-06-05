import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFoodEntryNutrition,
  aggregateDailyNutrition,
  aggregateWeeklyNutrition,
  NUTRIENT_KEYS
} from "../src/domain/nutrition.js";

test("scales per-100g nutrients by serving grams", () => {
  const result = calculateFoodEntryNutrition({
    name: "鸡胸肉",
    grams: 150,
    nutrientsPer100g: {
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      iron: 1
    }
  });

  assert.equal(result.totals.calories, 247.5);
  assert.equal(result.totals.protein, 46.5);
  assert.equal(result.totals.fat, 5.4);
  assert.equal(result.totals.iron, 1.5);
  assert.equal(result.totals.calcium, 0);
});

test("aggregates daily nutrition for one date only", () => {
  const entries = [
    { date: "2026-06-04", grams: 100, nutrientsPer100g: { calories: 100, protein: 10 } },
    { date: "2026-06-04", grams: 50, nutrientsPer100g: { calories: 200, protein: 5 } },
    { date: "2026-06-05", grams: 100, nutrientsPer100g: { calories: 999, protein: 99 } }
  ];

  const result = aggregateDailyNutrition(entries, "2026-06-04");

  assert.equal(result.calories, 200);
  assert.equal(result.protein, 12.5);
  assert.equal(result.fat, 0);
});

test("rounds daily nutrition once after aggregating raw nutrient values", () => {
  const entries = [
    { date: "2026-06-04", grams: 1, nutrientsPer100g: { iron: 0.4 } },
    { date: "2026-06-04", grams: 1, nutrientsPer100g: { iron: 0.4 } }
  ];

  const result = aggregateDailyNutrition(entries, "2026-06-04");

  assert.equal(result.iron, 0.01);
});

test("aggregates weekly nutrition into seven day buckets", () => {
  const entries = [
    { date: "2026-06-01", grams: 100, nutrientsPer100g: { calories: 100 } },
    { date: "2026-06-03", grams: 100, nutrientsPer100g: { calories: 300 } },
    { date: "2026-06-08", grams: 100, nutrientsPer100g: { calories: 800 } }
  ];

  const result = aggregateWeeklyNutrition(entries, "2026-06-01");

  assert.equal(result.length, 7);
  assert.equal(result[0].date, "2026-06-01");
  assert.equal(result[0].totals.calories, 100);
  assert.equal(result[2].totals.calories, 300);
  assert.equal(result[6].date, "2026-06-07");
  assert.equal(result[6].totals.calories, 0);
});

test("exports a stable nutrient key list", () => {
  assert.deepEqual(NUTRIENT_KEYS, [
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
  ]);
});
