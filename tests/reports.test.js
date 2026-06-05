import test from "node:test";
import assert from "node:assert/strict";
import { buildDailySummary, buildWeeklyReport } from "../src/domain/reports.js";

test("builds a daily summary from food and training records", () => {
  const summary = buildDailySummary({
    date: "2026-06-04",
    foodEntries: [
      { date: "2026-06-04", grams: 100, nutrientsPer100g: { calories: 200, protein: 20 } }
    ],
    trainingSessions: [
      { date: "2026-06-04", category: "strength", durationMinutes: 60, bodyWeightKg: 70 }
    ]
  });

  assert.equal(summary.date, "2026-06-04");
  assert.equal(summary.nutrition.calories, 200);
  assert.equal(summary.training.durationMinutes, 60);
  assert.equal(summary.training.calories, 350);
  assert.equal(summary.netCalories, -150);
});

test("builds seven weekly report rows and chart series", () => {
  const report = buildWeeklyReport({
    weekStart: "2026-06-01",
    foodEntries: [
      { date: "2026-06-02", grams: 100, nutrientsPer100g: { calories: 300, protein: 30 } }
    ],
    trainingSessions: [
      { date: "2026-06-02", category: "strength", durationMinutes: 30, bodyWeightKg: 70 }
    ]
  });

  assert.equal(report.days.length, 7);
  assert.equal(report.series.calorieIntake.length, 7);
  assert.deepEqual(report.series.dates, [
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
    "2026-06-04",
    "2026-06-05",
    "2026-06-06",
    "2026-06-07"
  ]);
  assert.equal(report.days[1].date, report.series.dates[1]);
  assert.equal(report.series.calorieIntake[0], 0);
  assert.equal(report.series.protein[0], 0);
  assert.equal(report.series.trainingCalories[0], 0);
  assert.equal(report.series.netCalories[0], 0);
  assert.equal(report.series.strengthVolume[0], 0);
  assert.equal(report.series.aerobicDistance[0], 0);
  assert.equal(report.series.protein[1], 30);
  assert.equal(report.series.trainingCalories[1], 175);
  assert.equal(report.series.netCalories[1], 125);
  assert.equal(report.days[1].netCalories, 125);
});
