import test from "node:test";
import assert from "node:assert/strict";
import { buildWidgetSnapshot, mergeCompletionDates } from "../src/domain/widgets.js";
import { buildBackupPayload, parseBackupText } from "../src/domain/backup.js";
import { bindAppInteractions, completeTodayGoal, configureStorageAdapters, getLocalDateString, renderGoalCard, renderWidgetSettings, resetStorageAdapters, state, syncWidgets } from "../src/app.js";

const goal = { id: "default", preferredExercise: "squat 深蹲", preferredMuscleGroup: "quads 股四头", weightGoalKg: 100 };
const workout = (date, weight, name = goal.preferredExercise) => ({ date, category: "strength", exercises: [{ name, sets: [{ weight, reps: 5 }] }] });

test("widget progress uses the configured exercise and actual today regardless of selected history", () => {
  const today = getLocalDateString();
  const sessions = [workout(today, 40), workout(today, 75), workout(today, 200, "bench press 卧推"), workout("2020-01-01", 120), { ...workout(today, 300), deletedAt: "deleted" }];
  const snapshot = buildWidgetSnapshot({ settings: goal, trainingSessions: sessions, selectedDate: "2020-01-01" });
  assert.equal(snapshot.date, today);
  assert.equal(snapshot.title, goal.preferredExercise);
  assert.equal(snapshot.detail, "quads 股四头 · 100 kg");
  assert.equal(snapshot.progress, 0.75);
  assert.deepEqual(snapshot.completionDates, []);
});

test("widget progress resets at the next local date and does not turn completion into recorded weight", () => {
  const settings = { ...goal, goalCompletionDates: ["2026-09-29"] };
  const sessions = [workout("2026-09-29", 250)];
  assert.equal(buildWidgetSnapshot({ settings, trainingSessions: sessions, today: "2026-09-29" }).progress, 1);
  const next = buildWidgetSnapshot({ settings, trainingSessions: sessions, today: "2026-09-30" });
  assert.equal(next.progress, 0);
  assert.equal(next.completionDates.includes(next.date), false);
  assert.equal(buildWidgetSnapshot({ settings, today: "2026-09-29" }).progress, 0);
  assert.equal(buildWidgetSnapshot({ settings: { ...goal, weightGoalKg: 0 }, trainingSessions: sessions, today: "2026-09-29" }).progress, 0);
});

test("completion dates merge monotonically, deduplicate and validate calendar dates", () => {
  assert.deepEqual(mergeCompletionDates(["2026-09-29", "2024-02-29"], ["2026-09-29", "2026-09-30", "2026-02-30", "2026-9-1", null], "bad"), ["2024-02-29", "2026-09-29", "2026-09-30"]);
});

test("backups preserve completion dates and reject malformed completion lists", () => {
  const backup = buildBackupPayload({ settings: { ...goal, goalCompletionDates: ["2024-02-29", "2026-09-29"] } });
  assert.deepEqual(parseBackupText(JSON.stringify(backup)).settings.goalCompletionDates, ["2024-02-29", "2026-09-29"]);
  for (const dates of ["2026-09-29", null, {}, [null], ["2026-02-29"], ["2026-09-31"]]) {
    assert.throws(() => parseBackupText(JSON.stringify({ ...backup, settings: { ...goal, goalCompletionDates: dates } })), /settings are invalid/);
  }
});

test("repeated completion is idempotent and never creates workouts or changes viewed date", async () => {
  const original = { ...state };
  const today = getLocalDateString();
  const sessions = [workout(today, 70)];
  const writes = [];
  Object.assign(state, { settings: { ...goal, custom: "keep" }, selectedDate: "2020-01-01", trainingSessions: sessions });
  configureStorageAdapters({ async saveRecord(store, record) { writes.push({ store, record }); return record; } });
  try {
    await Promise.all([completeTodayGoal(today), completeTodayGoal(today)]);
    await completeTodayGoal(today);
    assert.deepEqual(state.settings.goalCompletionDates, [today]);
    assert.equal(state.settings.custom, "keep");
    assert.equal(state.trainingSessions, sessions);
    assert.equal(state.selectedDate, "2020-01-01");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].store, "settings");
    await assert.rejects(completeTodayGoal("2020-01-01"), /日期已变化/);
    assert.equal(writes.length, 1);
  } finally { Object.assign(state, original); resetStorageAdapters(); }
});

test("native synchronization merges against current settings even if the response is stale", async () => {
  const original = { ...state };
  const originalWindow = globalThis.window;
  let finishSync;
  let started;
  const syncStarted = new Promise((resolve) => { started = resolve; });
  const sent = [];
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { FitnessWidgets: { sync(snapshot) {
    sent.push(snapshot);
    started();
    return new Promise((resolve) => { finishSync = resolve; });
  } } } } };
  Object.assign(state, { settings: { ...goal, goalCompletionDates: ["2026-09-28"] }, selectedDate: "2020-01-01", trainingSessions: [] });
  configureStorageAdapters({ async saveRecord(store, record) { assert.equal(store, "settings"); return record; } });
  try {
    const pending = syncWidgets();
    await syncStarted;
    state.settings = { ...state.settings, weightGoalKg: 120, goalCompletionDates: ["2026-09-28", "2026-09-29"] };
    finishSync({ completionDates: ["2026-09-27"] });
    await pending;
    assert.equal(sent[0].date, getLocalDateString());
    assert.equal(state.settings.weightGoalKg, 120);
    assert.deepEqual(state.settings.goalCompletionDates, ["2026-09-27", "2026-09-28", "2026-09-29"]);
  } finally { globalThis.window = originalWindow; Object.assign(state, original); resetStorageAdapters(); }
});

test("native completion merges the intent result and publishes the latest snapshot", async () => {
  const original = { ...state };
  const originalWindow = globalThis.window;
  const today = getLocalDateString();
  let intentCalls = 0;
  let snapshot;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { FitnessWidgets: {
    async completeToday() { intentCalls += 1; return { completionDates: [today, "2020-01-01"] }; },
    async sync(value) { snapshot = value; return { completionDates: value.completionDates }; }
  } } } };
  Object.assign(state, { settings: { ...goal }, trainingSessions: [workout(today, 50)] });
  configureStorageAdapters({ async saveRecord(store, record) { return record; } });
  try {
    await completeTodayGoal(today);
    await completeTodayGoal(today);
    assert.equal(intentCalls, 1);
    assert.equal(snapshot.progress, 0.5);
    assert.equal(snapshot.date, today);
    assert.deepEqual(state.settings.goalCompletionDates, ["2020-01-01", today]);
  } finally { globalThis.window = originalWindow; Object.assign(state, original); resetStorageAdapters(); }
});

test("only an explicit widget deep link opens today's training screen", async () => {
  const original = { ...state };
  const originalWindow = globalThis.window;
  let openGoal = false;
  globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { FitnessWidgets: {
    async sync() { return { completionDates: [], openGoal }; }
  } } } };
  Object.assign(state, { settings: { ...goal }, activeTab: "reports", selectedDate: "2020-01-01", activeDialog: "data" });
  try {
    await syncWidgets();
    assert.equal(state.activeTab, "reports");
    assert.equal(state.selectedDate, "2020-01-01");
    assert.equal(state.activeDialog, "data");
    openGoal = true;
    await syncWidgets();
    assert.equal(state.activeTab, "training");
    assert.equal(state.selectedDate, getLocalDateString());
    assert.equal(state.activeDialog, null);
  } finally { globalThis.window = originalWindow; Object.assign(state, original); }
});

test("importing an older backup cannot erase already completed days", async () => {
  const original = { ...state };
  const listeners = {};
  Object.assign(state, { settings: { ...goal, goalCompletionDates: ["2026-09-29"] }, foodEntries: [], trainingSessions: [] });
  configureStorageAdapters({ async saveRecord(store, record) { return record; } });
  bindAppInteractions({ addEventListener(type, handler) { listeners[type] = handler; } });
  const backup = buildBackupPayload({ settings: { ...goal, weightGoalKg: 80, goalCompletionDates: ["2026-09-28"] } });
  try {
    await listeners.change({ target: { matches: (selector) => selector === "[data-backup-input]", files: [{ async text() { return JSON.stringify(backup); } }], value: "backup.json" } });
    assert.deepEqual(state.settings.goalCompletionDates, ["2026-09-28", "2026-09-29"]);
    assert.equal(state.settings.weightGoalKg, 80);
    assert.deepEqual(state.trainingSessions, []);
  } finally { Object.assign(state, original); resetStorageAdapters(); }
});

test("goal controls never mark a historical day and all three previews are selectable", () => {
  const original = { ...state };
  const today = getLocalDateString();
  try {
    Object.assign(state, { settings: { ...goal }, selectedDate: "2020-01-01", trainingSessions: [] });
    assert.doesNotMatch(renderGoalCard(), /data-complete-goal/);
    assert.match(renderGoalCard(), /切换至今天完成任务/);
    state.selectedDate = today;
    assert.match(renderGoalCard(), new RegExp(`data-complete-goal="${today}"`));
    state.settings.goalCompletionDates = [today];
    const preview = renderWidgetSettings();
    for (const style of ["charcoal", "purple", "navy"]) assert.match(preview, new RegExp(`data-widget-style="${style}"`));
    assert.match(preview, /data-widget-percent="0"/);
    assert.match(preview, /今日任务已完成/);
    assert.match(preview, /桌面样式在添加小组件时选择/);
  } finally { Object.assign(state, original); }
});
