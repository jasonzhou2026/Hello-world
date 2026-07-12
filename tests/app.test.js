import test from "node:test";
import assert from "node:assert/strict";
import {
  bindAppInteractions,
  buildFoodEntryRecord,
  buildSettingsRecord,
  buildStrengthSessionRecord,
  countTrainingCategories,
  configureStorageAdapters,
  escapeHtml,
  getLocalDateString,
  getWeekStart,
  isStrengthSession,
  mealOptions,
  resetStorageAdapters,
  renderBarChart,
  renderAerobicChart,
  renderDualBarChart,
  renderMacronutrientSummary,
  renderMicronutrientSummary,
  renderTrainingCategoryChart,
  recordsInDateRange,
  resolveDefaultSettingsRecord,
  shouldSeedSamples,
  state
} from "../src/app.js";

test("escapes rendered text values for app markup", () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('bad')"> & text`),
    "&lt;img src=x onerror=&quot;alert(&#39;bad&#39;)&quot;&gt; &amp; text"
  );
});

test("gets the Monday week start for a selected date", () => {
  assert.equal(getWeekStart("2026-06-04"), "2026-06-01");
  assert.equal(getWeekStart("2026-06-07"), "2026-06-01");
});

test("formats selected dates from local date parts", () => {
  assert.equal(getLocalDateString(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(getLocalDateString(new Date(2026, 10, 14)), "2026-11-14");
});

test("builds one strength session with repeated sets from form values", () => {
  const session = buildStrengthSessionRecord({
    date: "2026-06-04",
    exerciseName: "Squat",
    muscleGroup: "Legs",
    reps: "5",
    weight: "80",
    setCount: "3",
    durationMinutes: "45",
    bodyWeightKg: 72
  });

  assert.equal(session.category, "strength");
  assert.equal(session.activityType, "strength");
  assert.equal(session.durationMinutes, 45);
  assert.deepEqual(session.exercises, [
    {
      name: "Squat",
      muscleGroup: "Legs",
      sets: [
        { reps: 5, weight: 80 },
        { reps: 5, weight: 80 },
        { reps: 5, weight: 80 }
      ]
    }
  ]);
});

test("builds one strength session with independent V2 set rows", () => {
  const session = buildStrengthSessionRecord({
    date: "2026-07-09",
    exerciseName: "bench press 卧推",
    muscleGroup: "chest 胸",
    handMode: "single 单手",
    weight1: "60",
    reps1: "8",
    weight2: "62.5",
    reps2: "",
    weight3: "",
    reps3: "10",
    weight4: "",
    reps4: "",
    durationMinutes: "50",
    bodyWeightKg: 72,
    notes: "pause reps"
  });

  assert.equal(session.category, "strength");
  assert.equal(session.handMode, "single");
  assert.equal(session.notes, "pause reps");
  assert.deepEqual(session.exercises, [
    {
      name: "bench press 卧推",
      muscleGroup: "chest 胸",
      sets: [
        { weight: 60, reps: 8 },
        { weight: 62.5, reps: 0 },
        { weight: 0, reps: 10 }
      ]
    }
  ]);
});

test("builds three editable exercises and splits left and right weights", () => {
  const session = buildStrengthSessionRecord({
    date: "2026-07-10",
    durationMinutes: "60",
    exerciseName1: "Dumbbell press 哑铃卧推",
    muscleGroup1: "chest 胸",
    handMode1: "split 左右手重量",
    e1leftWeight1: "20",
    e1rightWeight1: "22",
    e1reps1: "8",
    exerciseName2: "Custom pull 自定义拉",
    muscleGroup2: "back 背",
    handMode2: "single 单一重量",
    e2weight1: "50",
    e2reps1: "10",
    exerciseName3: "Plank 平板",
    muscleGroup3: "core 核心",
    handMode3: "single 单一重量",
    e3reps1: "45"
  });

  assert.equal(session.exercises.length, 3);
  assert.equal(session.exercises[0].name, "Dumbbell press 哑铃卧推");
  assert.deepEqual(session.exercises[0].sets[0], {
    weight: 42,
    leftWeight: 20,
    rightWeight: 22,
    reps: 8
  });
  assert.equal(session.exercises[1].sets[0].weight, 50);
  assert.equal(session.exercises[2].sets[0].reps, 45);
});

test("recognizes current and legacy strength session shapes", () => {
  assert.equal(isStrengthSession({ category: "strength" }), true);
  assert.equal(isStrengthSession({ activityType: "strength" }), true);
  assert.equal(isStrengthSession({ exercises: [{ name: "Squat" }] }), true);
  assert.equal(isStrengthSession({ category: "outdoor", activityType: "running" }), false);
  assert.equal(isStrengthSession(null), false);
});

test("builds settings targets while preserving local metadata", () => {
  const record = buildSettingsRecord(
    {
      bodyWeightKg: "74.5",
      calorieGoal: "2550",
      preferredExercise: "bench press 卧推",
      preferredMuscleGroup: "chest 胸",
      weightGoalKg: "90",
      bestExerciseNote: "Pause reps",
      personalMemo: "Sleep eight hours",
      protein: "155",
      carbs: "300",
      fat: "75",
      calcium: "1100",
      iron: "14",
      magnesium: "420",
      potassium: "3600",
      zinc: "12",
      sodium: "2100",
      fiber: "32",
      vitaminA: "950",
      vitaminC: "120",
      vitaminD: "20",
      vitaminB12: "3"
    },
    {
      id: "default",
      samplesSeeded: true,
      calorieGoalBand: { min: 250, max: 400, label: "增肌期" },
      macroTargets: { protein: 140, carbs: 280, fat: 70, custom: 1 },
      micronutrientTargets: { calcium: 1000, custom: 2 }
    }
  );

  assert.equal(record.id, "default");
  assert.equal(record.bodyWeightKg, 74.5);
  assert.equal(record.calorieGoal, 2550);
  assert.equal(record.preferredExercise, "bench press 卧推");
  assert.equal(record.preferredMuscleGroup, "chest 胸");
  assert.equal(record.weightGoalKg, 90);
  assert.equal(record.bestExerciseNote, "Pause reps");
  assert.equal(record.personalMemo, "Sleep eight hours");
  assert.deepEqual(record.macroTargets, {
    protein: 155,
    carbs: 300,
    fat: 75,
    custom: 1
  });
  assert.equal(record.micronutrientTargets.vitaminB12, 3);
  assert.equal(record.micronutrientTargets.custom, 2);
  assert.equal(record.samplesSeeded, true);
  assert.deepEqual(record.calorieGoalBand, { min: 250, max: 400, label: "增肌期" });
});

test("builds manual food records with all tracked nutrients", () => {
  const record = buildFoodEntryRecord({
    date: "2026-06-04",
    meal: "breakfast",
    name: "Fruit bowl",
    grams: "250",
    calories: "120",
    protein: "3",
    carbs: "26",
    fat: "1",
    fiber: "6",
    sugar: "18",
    sodium: "20",
    calcium: "40",
    iron: "1.2",
    magnesium: "25",
    potassium: "300",
    zinc: "0.6",
    vitaminA: "90",
    vitaminC: "45",
    vitaminD: "2",
    vitaminB12: "0.8",
    source: "manual"
  });

  assert.deepEqual(record.nutrientsPer100g, {
    calories: 120,
    protein: 3,
    carbs: 26,
    fat: 1,
    fiber: 6,
    sugar: 18,
    sodium: 20,
    calcium: 40,
    iron: 1.2,
    magnesium: 25,
    potassium: 300,
    zinc: 0.6,
    vitaminA: 90,
    vitaminC: 45,
    vitaminD: 2,
    vitaminB12: 0.8
  });
});

test("builds manual food records when grams are blank", () => {
  const record = buildFoodEntryRecord({
    date: "2026-07-09",
    meal: "snack",
    name: "Protein sample",
    grams: "",
    calories: "120",
    protein: "24",
    carbs: "",
    fat: "",
    source: "manual"
  });

  assert.equal(record.grams, 0);
  assert.equal(record.name, "Protein sample");
  assert.equal(record.nutrientsPer100g.calories, 120);
  assert.equal(record.nutrientsPer100g.protein, 24);
  assert.equal(record.nutrientsPer100g.carbs, 0);
});

test("meal options include workout and custom labels", () => {
  assert.deepEqual(mealOptions, [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
    "pre-workout",
    "post-workout",
    "custom"
  ]);
});

test("resolves only the default settings record when loading settings", () => {
  const defaultRecord = { id: "default", calorieGoal: 2400 };
  const legacyRecord = { id: "legacy", calorieGoal: 1800 };

  assert.deepEqual(resolveDefaultSettingsRecord([legacyRecord, defaultRecord]), {
    settings: defaultRecord,
    shouldCreateDefault: false
  });

  assert.deepEqual(resolveDefaultSettingsRecord([legacyRecord]), {
    settings: null,
    shouldCreateDefault: true
  });
});

test("seeds samples only when active records are empty and samples were not seeded", () => {
  assert.equal(
    shouldSeedSamples({
      foodEntries: [],
      trainingSessions: [],
      settings: { id: "default" }
    }),
    true
  );
  assert.equal(
    shouldSeedSamples({
      foodEntries: [],
      trainingSessions: [],
      settings: { id: "default", samplesSeeded: true }
    }),
    false
  );
  assert.equal(
    shouldSeedSamples({
      foodEntries: [{ id: "food-1" }],
      trainingSessions: [],
      settings: { id: "default" }
    }),
    false
  );
});

test("binds delegated UI events for submit, edit, tab, date, settings, and export actions", async (t) => {
  const originalFormData = globalThis.FormData;
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;
  const listeners = {};
  let createdDownload = null;
  let revokedUrl = null;

  const resetAppState = () => {
    state.activeTab = "overview";
    state.selectedDate = "2026-06-04";
    state.foodEntries = [{ id: "food-old", date: "2026-06-04", name: "Old food" }];
    state.trainingSessions = [];
    state.settings = {
      id: "default",
      bodyWeightKg: 72,
      calorieGoal: 2400,
      calorieGoalBand: { min: 2300, max: 2500 },
      macroTargets: { protein: 140, carbs: 280, fat: 70 },
      micronutrientTargets: {}
    };
    state.errorMessage = null;
    state.editingFoodId = null;
    state.editingTrainingId = null;
    state.trainingMode = "strength";
  };

  t.after(() => {
    globalThis.FormData = originalFormData;
    globalThis.document = originalDocument;
    globalThis.URL = originalUrl;
    resetStorageAdapters();
    resetAppState();
  });

  globalThis.FormData = class FakeFormData {
    constructor(form) {
      this.form = form;
    }

    entries() {
      return Object.entries(this.form.values);
    }
  };

  globalThis.document = {
    body: {
      append(link) {
        createdDownload = link;
      }
    },
    createElement(tagName) {
      assert.equal(tagName, "a");
      return {
        clickCount: 0,
        click() {
          this.clickCount += 1;
        },
        remove() {
          this.removed = true;
        }
      };
    }
  };

  globalThis.URL = {
    createObjectURL(blob) {
      assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return "blob:fitness-report";
    },
    revokeObjectURL(url) {
      revokedUrl = url;
    }
  };

  configureStorageAdapters({
    saveRecord: async (storeName, record) => ({ id: `${storeName}-new`, ...record })
  });
  resetAppState();

  const root = {
    addEventListener(type, handler) {
      listeners[type] = handler;
    }
  };
  bindAppInteractions(root);

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-training-mode]"
          ? { dataset: { trainingMode: "activity" } }
          : null;
      }
    }
  });
  assert.equal(state.trainingMode, "activity");

  const foodForm = {
    dataset: { form: "food" },
    values: {
      date: "2026-06-05",
      meal: "post-workout",
      name: "Recovery bowl",
      grams: "300",
      calories: "150",
      protein: "12",
      carbs: "22",
      fat: "4",
      fiber: "5",
      sugar: "8",
      sodium: "120",
      calcium: "80",
      iron: "2",
      magnesium: "45",
      potassium: "500",
      zinc: "1.2",
      vitaminA: "100",
      vitaminC: "20",
      vitaminD: "3",
      vitaminB12: "1",
      source: "manual"
    },
    closest(selector) {
      return selector === "form[data-form]" ? this : null;
    }
  };
  let submitPrevented = false;
  await listeners.submit({
    target: foodForm,
    preventDefault() {
      submitPrevented = true;
    }
  });

  assert.equal(submitPrevented, true);
  assert.equal(state.foodEntries.at(-1).name, "Recovery bowl");
  assert.equal(state.foodEntries.at(-1).meal, "post-workout");
  assert.equal(state.selectedDate, "2026-06-05");

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-edit-store][data-id]"
          ? { dataset: { editStore: "foodEntries", id: "food-old" } }
          : null;
      }
    }
  });
  assert.equal(state.editingFoodId, "food-old");
  assert.equal(state.selectedDate, "2026-06-04");

  const editFoodForm = {
    dataset: { form: "food", recordId: "food-old" },
    values: {
      date: "2026-06-05",
      meal: "dinner",
      name: "Updated food",
      grams: "180",
      calories: "210",
      source: "manual"
    },
    closest(selector) {
      return selector === "form[data-form]" ? this : null;
    }
  };
  await listeners.submit({ target: editFoodForm, preventDefault() {} });
  assert.equal(state.foodEntries.length, 2);
  assert.equal(state.foodEntries.find((entry) => entry.id === "food-old").name, "Updated food");
  assert.equal(state.editingFoodId, null);
  assert.equal(state.selectedDate, "2026-06-05");

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-edit-store][data-id]"
          ? { dataset: { editStore: "foodEntries", id: "food-old" } }
          : null;
      }
    }
  });
  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-cancel-edit]"
          ? { dataset: { cancelEdit: "foodEntries" } }
          : null;
      }
    }
  });
  assert.equal(state.editingFoodId, null);

  state.trainingSessions = [
    {
      id: "training-old",
      date: "2026-06-05",
      category: "strength",
      activityType: "strength",
      exercises: [
        {
          name: "Squat",
          muscleGroup: "Legs",
          sets: [
            { weight: 80, reps: 5 },
            { weight: 80, reps: 5 },
            { weight: 80, reps: 5 },
            { weight: 80, reps: 5 },
            { weight: 80, reps: 5 },
            { weight: 80, reps: 5 },
            { weight: 90, reps: 3 }
          ]
        },
        {
          name: "Bench press",
          muscleGroup: "Chest",
          sets: [{ weight: 60, reps: 8 }]
        }
      ]
    }
  ];
  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-edit-store][data-id]"
          ? { dataset: { editStore: "trainingSessions", id: "training-old" } }
          : null;
      }
    }
  });
  assert.equal(state.editingTrainingId, "training-old");

  const editStrengthForm = {
    dataset: { form: "strength", recordId: "training-old" },
    values: {
      date: "2026-06-05",
      exerciseName: "squat 深蹲",
      muscleGroup: "quads 股四头",
      handMode: "double 双手",
      durationMinutes: "55",
      weight1: "85",
      reps1: "5",
      weight2: "80",
      reps2: "5",
      weight3: "80",
      reps3: "5",
      weight4: "80",
      reps4: "5",
      weight5: "80",
      reps5: "5",
      weight6: "80",
      reps6: "5",
      notes: "edited"
    },
    closest(selector) {
      return selector === "form[data-form]" ? this : null;
    }
  };
  await listeners.submit({ target: editStrengthForm, preventDefault() {} });
  assert.equal(state.trainingSessions.length, 1);
  assert.equal(state.trainingSessions[0].id, "training-old");
  assert.equal(state.trainingSessions[0].durationMinutes, 55);
  assert.equal(state.trainingSessions[0].notes, "edited");
  assert.equal(state.trainingSessions[0].exercises[0].sets.length, 7);
  assert.deepEqual(state.trainingSessions[0].exercises[0].sets.at(-1), { weight: 90, reps: 3 });
  assert.equal(state.trainingSessions[0].exercises.length, 2);
  assert.equal(state.trainingSessions[0].exercises[1].name, "Bench press");
  assert.equal(state.editingTrainingId, null);

  state.activeTab = "settings";
  const settingsForm = {
    dataset: { form: "settings" },
    values: {
      bodyWeightKg: "75",
      calorieGoal: "2600",
      protein: "160",
      carbs: "310",
      fat: "80",
      calcium: "1100",
      iron: "14",
      magnesium: "420",
      potassium: "3600",
      zinc: "12",
      sodium: "2100",
      fiber: "32",
      vitaminA: "950",
      vitaminC: "120",
      vitaminD: "20",
      vitaminB12: "3"
    },
    closest(selector) {
      return selector === "form[data-form]" ? this : null;
    }
  };
  await listeners.submit({ target: settingsForm, preventDefault() {} });
  assert.equal(state.settings.id, "default");
  assert.equal(state.settings.bodyWeightKg, 75);
  assert.equal(state.settings.calorieGoal, 2600);
  assert.equal(state.settings.macroTargets.protein, 160);
  assert.deepEqual(state.settings.calorieGoalBand, { min: 2300, max: 2500 });
  assert.equal(state.activeTab, "overview");

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-tab]" ? { dataset: { tab: "reports" } } : null;
      }
    }
  });
  assert.equal(state.activeTab, "reports");

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-date-shift]" ? { dataset: { dateShift: "1" } } : null;
      }
    }
  });
  assert.equal(state.selectedDate, "2026-06-06");

  listeners.change({
    target: {
      value: "2026-06-07",
      matches(selector) {
        return selector === "[data-date-input]";
      }
    }
  });
  assert.equal(state.selectedDate, "2026-06-07");

  await listeners.click({
    target: {
      closest(selector) {
        return selector === '[data-action="download-xlsx"]'
          ? { dataset: { action: "download-xlsx" } }
          : null;
      }
    }
  });
  assert.equal(createdDownload.download, "fitness-report-2026-06-01.xlsx");
  assert.equal(createdDownload.clickCount, 1);
  assert.equal(createdDownload.removed, true);
  assert.equal(revokedUrl, "blob:fitness-report");
});

test("confirms report cleanup for a date range and keeps records outside it", async (t) => {
  const listeners = {};
  const deleted = [];
  t.after(() => {
    resetStorageAdapters();
    state.pendingCleanupRange = null;
    state.statusMessage = null;
  });

  configureStorageAdapters({
    softDeleteRecord: async (storeName, id) => deleted.push({ storeName, id })
  });
  state.selectedDate = "2026-07-09";
  state.foodEntries = [
    { id: "food-target", date: "2026-07-09" },
    { id: "food-target-2", date: "2026-07-10" },
    { id: "food-keep", date: "2026-07-11" }
  ];
  state.trainingSessions = [{ id: "training-target", date: "2026-07-09" }];

  bindAppInteractions({
    addEventListener(type, handler) {
      listeners[type] = handler;
    }
  });

  await listeners.click({
    target: {
      closest(selector) {
        return selector === '[data-action="request-range-delete"]'
          ? {
              closest(innerSelector) {
                return innerSelector === "[data-cleanup-form]"
                  ? {
                      querySelector(inputSelector) {
                        if (inputSelector === "[data-cleanup-start]") return { value: "2026-07-09" };
                        if (inputSelector === "[data-cleanup-end]") return { value: "2026-07-10" };
                        return null;
                      }
                    }
                  : null;
              }
            }
          : null;
      }
    }
  });
  assert.deepEqual(state.pendingCleanupRange, { start: "2026-07-09", end: "2026-07-10" });

  await listeners.click({
    target: {
      closest(selector) {
        return selector === '[data-action="confirm-range-delete"]' ? { dataset: {} } : null;
      }
    }
  });

  assert.deepEqual(deleted, [
    { storeName: "foodEntries", id: "food-target-2" },
    { storeName: "foodEntries", id: "food-target" },
    { storeName: "trainingSessions", id: "training-target" }
  ]);
  assert.deepEqual(state.foodEntries.map((entry) => entry.id), ["food-keep"]);
  assert.equal(state.trainingSessions.length, 0);
  assert.match(state.statusMessage, /Deleted 3 records/);
});

test("deletes an individual saved record from its list", async (t) => {
  const listeners = {};
  const deleted = [];
  t.after(() => resetStorageAdapters());
  configureStorageAdapters({
    softDeleteRecord: async (storeName, id) => deleted.push({ storeName, id })
  });
  state.foodEntries = [{ id: "food-delete", date: "2026-07-10", name: "Delete me" }];
  state.trainingSessions = [];
  bindAppInteractions({ addEventListener(type, handler) { listeners[type] = handler; } });

  await listeners.click({
    target: {
      closest(selector) {
        return selector === "[data-delete-store][data-id]"
          ? { dataset: { deleteStore: "foodEntries", id: "food-delete" } }
          : null;
      }
    }
  });

  assert.deepEqual(deleted, [{ storeName: "foodEntries", id: "food-delete" }]);
  assert.equal(state.foodEntries.length, 0);
});

test("filters records by an inclusive date range in either input order", () => {
  const records = [
    { id: "a", date: "2026-07-08" },
    { id: "b", date: "2026-07-09" },
    { id: "c", date: "2026-07-10" }
  ];
  assert.deepEqual(recordsInDateRange(records, "2026-07-10", "2026-07-09").map((item) => item.id).sort(), ["b", "c"]);
});

test("counts weekly training sessions as strength, aerobic, and other", () => {
  const counts = countTrainingCategories([
    { date: "2026-07-06", category: "strength", exercises: [{}] },
    { date: "2026-07-07", activityType: "running" },
    { date: "2026-07-08", activityType: "yoga" },
    { date: "2026-07-20", activityType: "cycling" }
  ], "2026-07-06");
  assert.deepEqual(counts, { strength: 1, aerobic: 1, other: 1 });
});

test("renders training categories as a vertical bar chart", () => {
  const chart = renderTrainingCategoryChart([
    { date: "2026-07-06", category: "strength", exercises: [{}] },
    { date: "2026-07-07", activityType: "running" }
  ], "2026-07-06");
  assert.match(chart, /<svg\b/);
  assert.match(chart, /<rect\b[^>]*bar-strength/);
  assert.match(chart, /<rect\b[^>]*bar-distance/);
  assert.match(chart, /Strength 力量/);
});

test("renders aerobic distance and duration in one chart", () => {
  const chart = renderAerobicChart(["2026-07-09"], [5.2], [32]);
  assert.match(chart, /bar-distance/);
  assert.match(chart, /bar-duration/);
  assert.match(chart, /5.2 km, 32 min/);
});

test("renders the aerobic chart when upgrading from a report without duration data", () => {
  const chart = renderAerobicChart(["2026-07-09"], [5.2], undefined);
  assert.match(chart, /bar-distance/);
  assert.match(chart, /bar-duration/);
});

test("renders report bar charts as escaped inline SVG", () => {
  const chart = renderBarChart(
    "Protein <daily>",
    ["2026-06-04"],
    [140],
    "g <unit>",
    "bar-protein"
  );

  assert.match(chart, /<svg\b/);
  assert.match(chart, /<rect\b/);
  assert.match(chart, /role="img"/);
  assert.match(chart, /aria-label="Protein &lt;daily&gt;"/);
  assert.match(chart, /Protein &lt;daily&gt;/);
  assert.match(chart, /g &lt;unit&gt;/);
  assert.doesNotMatch(chart, /<text class="svg-value"/);
  assert.doesNotMatch(chart, /Protein <daily>/);
});

test("renders report dual charts as grouped inline SVG bars", () => {
  const chart = renderDualBarChart(
    "Calories <weekly>",
    ["2026-06-04"],
    [2100],
    [350],
    "Intake <food>",
    "Training <work>",
    "kcal"
  );

  assert.match(chart, /<svg\b/);
  assert.match(chart, /<rect\b[^>]*bar-intake/);
  assert.match(chart, /<rect\b[^>]*bar-training/);
  assert.match(chart, /aria-label="Calories &lt;weekly&gt;"/);
  assert.match(chart, /Intake &lt;food&gt; \/ Training &lt;work&gt;/);
});

test("renders net calorie and aerobic duration report charts as inline SVG", () => {
  const netChart = renderBarChart(
    "Net calorie balance",
    ["2026-06-04", "2026-06-05"],
    [-200, 150],
    "kcal",
    "bar-net"
  );
  const durationChart = renderBarChart(
    "Aerobic duration",
    ["2026-06-04", "2026-06-05"],
    [40, 25],
    "min",
    "bar-duration"
  );

  assert.match(netChart, /<svg\b/);
  assert.match(netChart, /bar-net/);
  assert.match(netChart, /aria-label="Net calorie balance"/);
  assert.match(durationChart, /<svg\b/);
  assert.match(durationChart, /bar-duration/);
  assert.match(durationChart, /aria-label="Aerobic duration"/);
});

test("renders compact weekly macro and micro summaries", () => {
  const report = {
    days: [
      {
        nutrition: {
          protein: 100,
          carbs: 220,
          fat: 70,
          calcium: 500,
          iron: 8,
          magnesium: 200,
          potassium: 1500,
          zinc: 6,
          vitaminA: 300,
          vitaminC: 60,
          vitaminD: 8,
          vitaminB12: 1.4,
          sodium: 1200,
          fiber: 18
        }
      },
      {
        nutrition: {
          protein: 80,
          carbs: 180,
          fat: 60,
          calcium: 450,
          iron: 6,
          magnesium: 160,
          potassium: 1400,
          zinc: 4,
          vitaminA: 260,
          vitaminC: 40,
          vitaminD: 5,
          vitaminB12: 1,
          sodium: 1000,
          fiber: 14
        }
      }
    ]
  };
  const settings = {
    macroTargets: { protein: 140, carbs: 280, fat: 70 },
    micronutrientTargets: {
      calcium: 1000,
      iron: 12,
      magnesium: 400,
      potassium: 3500,
      zinc: 11,
      vitaminA: 900,
      vitaminC: 100,
      vitaminD: 15,
      vitaminB12: 2.4,
      sodium: 2000,
      fiber: 30
    }
  };

  const macro = renderMacronutrientSummary(report, settings);
  const micro = renderMicronutrientSummary(report, settings);

  assert.match(macro, /Macronutrient split/);
  assert.match(macro, /Protein/);
  assert.match(macro, /progress-bar/);
  assert.match(micro, /Micronutrient completion/);
  assert.match(micro, /Vitamin B12/);
  assert.match(micro, /progress-bar/);
});
