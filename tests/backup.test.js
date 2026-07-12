import test from "node:test";
import assert from "node:assert/strict";
import { buildBackupPayload, parseBackupText } from "../src/domain/backup.js";

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
