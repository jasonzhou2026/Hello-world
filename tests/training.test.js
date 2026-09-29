import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStrengthVolume,
  calculateTrainingCalories,
  getMet,
  summarizeTrainingForDate
} from "../src/domain/training.js";

test("calculates strength volume from sets", () => {
  const volume = calculateStrengthVolume([
    { reps: 5, weight: 80 },
    { reps: 5, weight: 80 },
    { reps: 8, weight: 60 }
  ]);

  assert.equal(volume, 1280);
});

test("calculates MET-based training calories", () => {
  const calories = calculateTrainingCalories({
    activityType: "running",
    durationMinutes: 30,
    bodyWeightKg: 70,
    intensity: "moderate"
  });

  assert.equal(calories, 280);
});

test("summarizes mixed training for one date", () => {
  const sessions = [
    {
      date: "2026-06-04",
      category: "strength",
      durationMinutes: 45,
      bodyWeightKg: 70,
      exercises: [{ sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }] }]
    },
    {
      date: "2026-06-04",
      category: "outdoor",
      activityType: "cycling",
      durationMinutes: 60,
      distanceKm: 22,
      bodyWeightKg: 70,
      intensity: "moderate"
    },
    {
      date: "2026-06-05",
      category: "outdoor",
      activityType: "running",
      durationMinutes: 60,
      bodyWeightKg: 70
    }
  ];

  const summary = summarizeTrainingForDate(sessions, "2026-06-04");

  assert.equal(summary.strengthVolume, 1000);
  assert.equal(summary.totalSets, 2);
  assert.equal(summary.durationMinutes, 105);
  assert.equal(summary.distanceKm, 22);
  assert.equal(summary.calories, 753);
});

test("looks up MET values for known activity intensities", () => {
  assert.equal(getMet("running", "hard"), 11);
});

test("falls back to other moderate MET for unknown activity and intensity", () => {
  const calories = calculateTrainingCalories({
    activityType: "pickleball",
    intensity: "max",
    durationMinutes: 60,
    bodyWeightKg: 70
  });

  assert.equal(calories, 350);
});

test("defaults missing body weight to 70kg", () => {
  const calories = calculateTrainingCalories({
    activityType: "running",
    durationMinutes: 30,
    intensity: "moderate"
  });

  assert.equal(calories, 280);
});

test("uses category as activity fallback when activity type is absent", () => {
  const calories = calculateTrainingCalories({
    category: "strength",
    durationMinutes: 60,
    bodyWeightKg: 80
  });

  assert.equal(calories, 400);
});

test("defaults explicit zero body weight to 70kg", () => {
  const calories = calculateTrainingCalories({
    activityType: "walking",
    durationMinutes: 60,
    bodyWeightKg: 0,
    intensity: "moderate"
  });

  assert.equal(calories, 280);
});

test("daily total replaces legacy duration and calories while retaining exercises and distance", () => {
  const sessions = [
    { date: "2026-09-29", category: "strength", activityType: "strength", durationMinutes: 45, bodyWeightKg: 70, exercises: [{ sets: [{ weight: 80, reps: 5 }] }] },
    { date: "2026-09-29", category: "outdoor", activityType: "running", durationMinutes: 30, bodyWeightKg: 70, distanceKm: 5 },
    { date: "2026-09-29", category: "duration", activityType: "cycling", durationMinutes: 60, bodyWeightKg: 70, intensity: "moderate" },
    { date: "2026-09-30", category: "duration", activityType: "strength", durationMinutes: 200, bodyWeightKg: 70 }
  ];
  assert.deepEqual(summarizeTrainingForDate(sessions, "2026-09-29"), {
    strengthVolume: 400,
    totalSets: 1,
    durationMinutes: 60,
    aerobicDurationMinutes: 60,
    distanceKm: 5,
    calories: 490
  });
});

test("explicit zero daily total overrides old activity duration and calorie estimates", () => {
  const sessions = [
    { date: "2026-09-29", activityType: "running", durationMinutes: 40, bodyWeightKg: 70, distanceKm: 6 },
    { date: "2026-09-29", category: "duration", activityType: "strength", durationMinutes: 0, bodyWeightKg: 70 }
  ];
  const summary = summarizeTrainingForDate(sessions, "2026-09-29");
  assert.equal(summary.durationMinutes, 0);
  assert.equal(summary.aerobicDurationMinutes, 0);
  assert.equal(summary.calories, 0);
  assert.equal(summary.distanceKm, 6);
});

test("latest daily total wins among imported duplicates without mutating source records", () => {
  const sessions = [
    { id: "duration-old", date: "2026-09-29", category: "duration", activityType: "running", durationMinutes: 90, bodyWeightKg: 70, updatedAt: "2026-09-29T10:00:00Z" },
    { id: "duration-new", date: "2026-09-29", category: "duration", activityType: "strength", durationMinutes: 50, bodyWeightKg: 70, updatedAt: "2026-09-29T12:00:00Z" }
  ];
  const original = structuredClone(sessions);
  const summary = summarizeTrainingForDate(sessions, "2026-09-29");
  assert.equal(summary.durationMinutes, 50);
  assert.equal(summary.aerobicDurationMinutes, 0);
  assert.equal(summary.calories, 292);
  assert.deepEqual(sessions, original);
});
