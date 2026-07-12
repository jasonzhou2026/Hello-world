import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMuscleRecency,
  buildTrainingComparison,
  canonicalMuscleGroup
} from "../src/domain/overview.js";

test("builds five-point comparison from the latest same-day exercise", () => {
  const trainingSessions = Array.from({ length: 6 }, (_, index) => ({
    id: `session-${index}`,
    date: `2026-07-${String(index + 4).padStart(2, "0")}`,
    category: "strength",
    updatedAt: `2026-07-${String(index + 4).padStart(2, "0")}T10:00:00Z`,
    exercises: [
      {
        name: "squat 深蹲",
        muscleGroup: "quads 股四头",
        sets: [{ weight: 80 + index * 2.5, reps: 5 }]
      }
    ]
  }));

  const comparison = buildTrainingComparison({
    date: "2026-07-09",
    trainingSessions
  });

  assert.equal(comparison.exerciseName, "squat 深蹲");
  assert.equal(comparison.points.length, 5);
  assert.equal(comparison.points[0].date, "2026-07-05");
  assert.equal(comparison.points.at(-1).maxWeight, 92.5);
});

test("maps bilingual muscle names and recency states", () => {
  const recency = buildMuscleRecency({
    date: "2026-07-09",
    trainingSessions: [
      {
        date: "2026-07-09",
        category: "strength",
        exercises: [{ muscleGroup: "chest 胸" }]
      },
      {
        date: "2026-07-06",
        category: "strength",
        exercises: [{ muscleGroup: "back 背" }]
      }
    ]
  });

  assert.equal(canonicalMuscleGroup("quads 股四头"), "quads");
  assert.equal(canonicalMuscleGroup("calves 小腿"), "calves");
  assert.equal(recency.chest.state, "recent");
  assert.equal(recency.back.state, "warm");
  assert.equal(recency.calves.state, "attention");
});
