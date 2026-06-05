import test from "node:test";
import assert from "node:assert/strict";
import {
  bindAppInteractions,
  buildFoodEntryRecord,
  buildStrengthSessionRecord,
  configureStorageAdapters,
  escapeHtml,
  getLocalDateString,
  getWeekStart,
  mealOptions,
  resetStorageAdapters,
  renderBarChart,
  renderDualBarChart,
  renderMacronutrientSummary,
  renderMicronutrientSummary,
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

test("binds delegated UI events for submit, tab, date, delete, and export actions", async (t) => {
  const originalFormData = globalThis.FormData;
  const originalDocument = globalThis.document;
  const originalUrl = globalThis.URL;
  const listeners = {};
  let deletedRecord = null;
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
    saveRecord: async (storeName, record) => ({ id: `${storeName}-new`, ...record }),
    softDeleteRecord: async (storeName, id) => {
      deletedRecord = { storeName, id };
    }
  });
  resetAppState();

  const root = {
    addEventListener(type, handler) {
      listeners[type] = handler;
    }
  };
  bindAppInteractions(root);

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
        return selector === "[data-delete-store][data-id]"
          ? { dataset: { deleteStore: "foodEntries", id: "food-old" } }
          : null;
      }
    }
  });
  assert.deepEqual(deletedRecord, { storeName: "foodEntries", id: "food-old" });
  assert.equal(state.foodEntries.some((entry) => entry.id === "food-old"), false);

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
