import test from "node:test";
import assert from "node:assert/strict";
import { buildBackupPayload, parseBackupText } from "../src/domain/backup.js";
import { defaultSettings, sampleFoodEntries, sampleTrainingSessions } from "../src/sampleData.js";

test("builds and parses a versioned local backup", () => {
  const payload = buildBackupPayload({
    settings: { id: "default", calorieGoal: 2500 },
    foodEntries: [{ id: "food-1", date: "2026-07-09" }],
    trainingSessions: [{ id: "training-1", date: "2026-07-09" }]
  });
  const restored = parseBackupText(JSON.stringify(payload));

  assert.equal(payload.format, "fitness-pwa-backup");
  assert.equal(payload.version, 1);
  assert.equal(restored.settings.id, "default");
  assert.deepEqual(restored.foodEntries, [{ id: "food-1", date: "2026-07-09" }]);
  assert.deepEqual(restored.trainingSessions, [{ id: "training-1", date: "2026-07-09" }]);
});

test("rejects invalid or unsupported backups", () => {
  assert.throws(() => parseBackupText("not json"), /valid JSON/);
  assert.throws(
    () => parseBackupText(JSON.stringify({ format: "fitness-pwa-backup", version: 2 })),
    /not supported/
  );
});

test("preserves legacy optional fields, numeric strings and additional metadata", () => {
  const payload = buildBackupPayload({
    settings: { ...defaultSettings, calorieGoalBand: { min: -200, max: 200, label: "维持" }, importedTag: "keep" },
    foodEntries: [...sampleFoodEntries, { date: "2024-02-29", grams: "100", nutrientsPer100g: { calories: "125.5" }, extra: { source: "legacy" } }],
    trainingSessions: [...sampleTrainingSessions, { date: "2026-09-29", exercises: [{ name: "卧推", sets: [{ weight: "20", reps: "10", leftWeight: 8, rightWeight: 12, custom: true }] }] }, { date: "2026-09-29", category: "duration", durationMinutes: 0 }]
  });
  const restored = parseBackupText(JSON.stringify(payload));
  assert.deepEqual(restored, { settings: { ...payload.settings, id: "default" }, foodEntries: payload.foodEntries, trainingSessions: payload.trainingSessions });
});

test("rejects malformed record dates and record items instead of silently dropping them", () => {
  for (const store of ["foodEntries", "trainingSessions"]) {
    for (const record of [null, [], "record", 12, {}, { date: "2026-02-30" }, { date: "2026-2-1" }, { date: "not a date" }, { date: "2026-09-29", id: {} }]) {
      const payload = buildBackupPayload({ settings: null, [store]: [record] });
      assert.throws(() => parseBackupText(JSON.stringify(payload)), /records are invalid/);
    }
  }
});

test("rejects unsafe exercise and set shapes before they can enter the database", () => {
  const invalidExercises = ["broken", {}, null, [null], ["exercise"], [{ name: {} }], [{ sets: "broken" }], [{ sets: {} }], [{ sets: [null] }], [{ sets: ["set"] }], [{ sets: [{ weight: [] }] }], [{ sets: [{ reps: true }] }], [{ sets: [{ leftWeight: -1 }] }], [{ sets: [{ rightWeight: "Infinity" }] }]];
  for (const exercises of invalidExercises) {
    const payload = buildBackupPayload({ settings: null, trainingSessions: [{ id: "broken", date: "2026-09-29", exercises }] });
    assert.throws(() => parseBackupText(JSON.stringify(payload)), /training records are invalid/);
  }
});

test("rejects malformed quantities, nutrition and settings while accepting empty backups", () => {
  const empty = buildBackupPayload();
  assert.deepEqual(parseBackupText(JSON.stringify(empty)), { settings: null, foodEntries: [], trainingSessions: [] });
  for (const record of [{ grams: {} }, { grams: -1 }, { nutrientsPer100g: [] }, { nutrientsPer100g: null }, { nutrientsPer100g: { calories: "unknown" } }, { nutrientsPer100g: { protein: true } }]) {
    assert.throws(() => parseBackupText(JSON.stringify({ ...empty, foodEntries: [{ date: "2026-09-29", ...record }] })), /food records are invalid/);
  }
  for (const record of [{ durationMinutes: [] }, { durationMinutes: "1e999" }, { distanceKm: -1 }, { bodyWeightKg: true }, { activityType: {} }]) {
    assert.throws(() => parseBackupText(JSON.stringify({ ...empty, trainingSessions: [{ date: "2026-09-29", ...record }] })), /training records are invalid/);
  }
  for (const settings of [[], "settings", { bodyWeightKg: [] }, { macroTargets: [] }, { micronutrientTargets: null }, { macroTargets: { protein: "" } }, { calorieGoalBand: [] }, { calorieGoalBand: { min: {} } }, { samplesSeeded: "yes" }]) {
    assert.throws(() => parseBackupText(JSON.stringify({ ...empty, settings })), /settings are invalid/);
  }
});
