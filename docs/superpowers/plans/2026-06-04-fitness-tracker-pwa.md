# Fitness Tracker PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first local-first fitness and nutrition PWA with manual food/training records, professional dashboard summaries, weekly charts, and Excel export.

**Architecture:** The app is a static browser application made of focused ES modules. Business logic lives in pure utility modules with Node tests; browser-only storage and UI modules consume those utilities. Excel export uses a lightweight in-repo `.xlsx` writer so the first version does not require network dependency installation.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, IndexedDB, Service Worker, Web App Manifest, Node built-in `node:test`.

---

## File Structure

- Create `package.json`: script entry points for tests and local static serving.
- Create `index.html`: PWA shell and app root.
- Create `manifest.webmanifest`: installable app metadata.
- Create `service-worker.js`: offline asset cache.
- Create `src/styles.css`: mobile-first professional dashboard styling.
- Create `src/domain/nutrition.js`: nutrient constants, food scaling, daily/weekly nutrition aggregation.
- Create `src/domain/training.js`: strength volume and MET calorie calculations.
- Create `src/domain/reports.js`: daily summaries and weekly chart series shaping.
- Create `src/export/xlsx.js`: minimal `.xlsx` workbook generator.
- Create `src/storage/db.js`: IndexedDB persistence.
- Create `src/sampleData.js`: useful starter records for first-run demonstration.
- Create `src/app.js`: app state, rendering, forms, charts, export, and event wiring.
- Create `tests/nutrition.test.js`: nutrition calculation tests.
- Create `tests/training.test.js`: training calculation tests.
- Create `tests/reports.test.js`: report aggregation tests.
- Create `tests/xlsx.test.js`: export workbook tests.

## Implementation Tasks

### Task 1: Project Shell And Test Harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `src/styles.css`
- Create: `src/app.js`

- [ ] **Step 1: Create package metadata and scripts**

Add `package.json`:

```json
{
  "name": "fitness-tracker-pwa",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "serve": "python3 -m http.server 4173"
  }
}
```

- [ ] **Step 2: Create the PWA HTML shell**

Add `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#182235" />
    <title>训练与营养记录</title>
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <main id="app" class="app-shell" aria-live="polite"></main>
    <script type="module" src="./src/app.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create manifest**

Add `manifest.webmanifest`:

```json
{
  "name": "训练与营养记录",
  "short_name": "健身记录",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#f6f8fb",
  "theme_color": "#182235",
  "icons": []
}
```

- [ ] **Step 4: Create service worker**

Add `service-worker.js`:

```js
const CACHE_NAME = "fitness-tracker-pwa-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/styles.css",
  "./src/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 5: Create base styles**

Add `src/styles.css` with these concrete sections: CSS variables for the professional palette, `.app-shell`, `.screen`, `.topbar`, `.card-grid`, `.metric-card`, `.progress-bar`, `.bottom-tabs`, `.entry-form`, `.record-list`, `.chart-card`, `.bar-chart`, `.line-chart`, and a `@media (min-width: 760px)` rule that centers the app at a max width of 760px.

- [ ] **Step 6: Create temporary app entry**

Add `src/app.js`:

```js
document.querySelector("#app").innerHTML = `
  <section class="screen">
    <h1>训练与营养记录</h1>
    <p>应用正在初始化。</p>
  </section>
`;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}
```

- [ ] **Step 7: Run baseline test command**

Run: `npm test`

Expected: command exits successfully after Node reports no matching tests or after test files are added in later tasks. If Node treats no tests as failure, continue after Task 2 creates the first tests.

### Task 2: Nutrition Calculations

**Files:**
- Create: `tests/nutrition.test.js`
- Create: `src/domain/nutrition.js`

- [ ] **Step 1: Write failing nutrition tests**

Add `tests/nutrition.test.js`:

```js
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
});

test("exports a stable nutrient key list", () => {
  assert.ok(NUTRIENT_KEYS.includes("calories"));
  assert.ok(NUTRIENT_KEYS.includes("vitaminB12"));
  assert.ok(NUTRIENT_KEYS.includes("potassium"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/domain/nutrition.js` does not exist.

- [ ] **Step 3: Implement nutrition utilities**

Create `src/domain/nutrition.js` with:

```js
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
    totals[key] = roundMetric((Number(a[key]) || 0) + (Number(b[key]) || 0));
  }
  return totals;
}

export function aggregateDailyNutrition(entries, date) {
  return entries
    .filter((entry) => entry.date === date)
    .map(calculateFoodEntryNutrition)
    .reduce((totals, entry) => addNutritionTotals(totals, entry.totals), emptyNutritionTotals());
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function aggregateWeeklyNutrition(entries, weekStart) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return { date, totals: aggregateDailyNutrition(entries, date) };
  });
}
```

- [ ] **Step 4: Run nutrition tests**

Run: `npm test`

Expected: PASS for all nutrition tests.

### Task 3: Training Calculations

**Files:**
- Create: `tests/training.test.js`
- Create: `src/domain/training.js`

- [ ] **Step 1: Write failing training tests**

Add `tests/training.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateStrengthVolume,
  calculateTrainingCalories,
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
  assert.ok(summary.calories > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/domain/training.js` does not exist.

- [ ] **Step 3: Implement training utilities**

Create `src/domain/training.js` with:

```js
const MET_TABLE = {
  strength: { light: 3.5, moderate: 5, hard: 6 },
  running: { light: 7, moderate: 8, hard: 11 },
  cycling: { light: 5, moderate: 7, hard: 10 },
  walking: { light: 3, moderate: 4, hard: 5 },
  hiking: { light: 5, moderate: 6, hard: 8 },
  hiit: { light: 6, moderate: 8, hard: 10 },
  yoga: { light: 2.5, moderate: 3, hard: 4 },
  mobility: { light: 2, moderate: 2.5, hard: 3 },
  swimming: { light: 6, moderate: 8, hard: 10 },
  rowing: { light: 5, moderate: 7, hard: 9 },
  other: { light: 3, moderate: 5, hard: 7 }
};

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function calculateStrengthVolume(sets = []) {
  return roundMetric(
    sets.reduce((total, set) => {
      return total + (Number(set.reps) || 0) * (Number(set.weight) || 0);
    }, 0)
  );
}

export function getMet(activityType = "other", intensity = "moderate") {
  const row = MET_TABLE[activityType] || MET_TABLE.other;
  return row[intensity] || row.moderate;
}

export function calculateTrainingCalories(session) {
  const activityType = session.activityType || session.category || "other";
  const intensity = session.intensity || "moderate";
  const met = getMet(activityType, intensity);
  const bodyWeightKg = Number(session.bodyWeightKg) || 70;
  const durationHours = (Number(session.durationMinutes) || 0) / 60;
  return Math.round(met * bodyWeightKg * durationHours);
}

export function summarizeTrainingForDate(sessions, date) {
  return sessions
    .filter((session) => session.date === date)
    .reduce(
      (summary, session) => {
        const exercises = session.exercises || [];
        const sets = exercises.flatMap((exercise) => exercise.sets || []);
        summary.strengthVolume += calculateStrengthVolume(sets);
        summary.totalSets += sets.length;
        summary.durationMinutes += Number(session.durationMinutes) || 0;
        summary.distanceKm += Number(session.distanceKm) || 0;
        summary.calories += calculateTrainingCalories(session);
        return summary;
      },
      { strengthVolume: 0, totalSets: 0, durationMinutes: 0, distanceKm: 0, calories: 0 }
    );
}
```

- [ ] **Step 4: Run training tests**

Run: `npm test`

Expected: PASS for nutrition and training tests.

### Task 4: Daily And Weekly Report Aggregation

**Files:**
- Create: `tests/reports.test.js`
- Create: `src/domain/reports.js`

- [ ] **Step 1: Write failing report tests**

Add `tests/reports.test.js`:

```js
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
  assert.equal(summary.netCalories, summary.nutrition.calories - summary.training.calories);
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
  assert.equal(report.series.protein[1], 30);
  assert.ok(report.series.trainingCalories[1] > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/domain/reports.js` does not exist.

- [ ] **Step 3: Implement report utilities**

Create `src/domain/reports.js` with:

```js
import { addDays, aggregateDailyNutrition } from "./nutrition.js";
import { summarizeTrainingForDate } from "./training.js";

export function buildDailySummary({ date, foodEntries, trainingSessions }) {
  const nutrition = aggregateDailyNutrition(foodEntries, date);
  const training = summarizeTrainingForDate(trainingSessions, date);
  return {
    date,
    nutrition,
    training,
    netCalories: Math.round(nutrition.calories - training.calories)
  };
}

export function buildWeeklyReport({ weekStart, foodEntries, trainingSessions }) {
  const days = Array.from({ length: 7 }, (_, index) =>
    buildDailySummary({
      date: addDays(weekStart, index),
      foodEntries,
      trainingSessions
    })
  );

  return {
    weekStart,
    days,
    series: {
      dates: days.map((day) => day.date),
      calorieIntake: days.map((day) => day.nutrition.calories),
      trainingCalories: days.map((day) => day.training.calories),
      netCalories: days.map((day) => day.netCalories),
      protein: days.map((day) => day.nutrition.protein),
      strengthVolume: days.map((day) => day.training.strengthVolume),
      aerobicDistance: days.map((day) => day.training.distanceKm)
    }
  };
}
```

- [ ] **Step 4: Run report tests**

Run: `npm test`

Expected: PASS for nutrition, training, and report tests.

### Task 5: Excel Workbook Export

**Files:**
- Create: `tests/xlsx.test.js`
- Create: `src/export/xlsx.js`

- [ ] **Step 1: Write failing Excel export tests**

Add `tests/xlsx.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportRows,
  createWorkbookBlobParts,
  createWorkbookBuffer
} from "../src/export/xlsx.js";

test("shapes export rows for all workbook sheets", () => {
  const rows = buildExportRows({
    foodEntries: [
      {
        date: "2026-06-04",
        meal: "lunch",
        name: "鸡胸饭",
        grams: 300,
        nutrientsPer100g: { calories: 180, protein: 12, carbs: 24, fat: 4 }
      }
    ],
    trainingSessions: [
      {
        date: "2026-06-04",
        category: "strength",
        activityType: "strength",
        durationMinutes: 60,
        bodyWeightKg: 70,
        exercises: [{ name: "深蹲", muscleGroup: "腿", sets: [{ reps: 5, weight: 80 }] }]
      }
    ],
    weekStart: "2026-06-01"
  });

  assert.ok(rows["Daily Summary"].length >= 2);
  assert.ok(rows["Food Details"].length >= 2);
  assert.ok(rows["Training Details"].length >= 2);
  assert.ok(rows["Nutrition Stats"].length >= 2);
  assert.ok(rows["Weekly Report Data"].length >= 2);
});

test("creates an xlsx zip buffer with workbook files", () => {
  const sheets = {
    "Daily Summary": [["Date", "Calories"], ["2026-06-04", 200]],
    "Food Details": [["Food"], ["鸡胸饭"]]
  };

  const parts = createWorkbookBlobParts(sheets);
  const buffer = createWorkbookBuffer(sheets);
  const text = buffer.toString("latin1");

  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
  assert.ok(parts.length > 0);
  assert.ok(text.includes("xl/workbook.xml"));
  assert.ok(text.includes("xl/worksheets/sheet1.xml"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `src/export/xlsx.js` does not exist.

- [ ] **Step 3: Implement workbook export**

Create `src/export/xlsx.js` with these public functions:

```js
import { calculateFoodEntryNutrition, NUTRIENT_KEYS } from "../domain/nutrition.js";
import { buildWeeklyReport } from "../domain/reports.js";
import { calculateStrengthVolume, calculateTrainingCalories } from "../domain/training.js";

export function buildExportRows({ foodEntries, trainingSessions, weekStart }) {
  const weekly = buildWeeklyReport({ weekStart, foodEntries, trainingSessions });
  return {
    "Daily Summary": [
      ["Date", "Intake Calories", "Training Calories", "Net Calories", "Protein", "Carbohydrate", "Fat", "Fiber", "Strength Volume", "Training Duration", "Aerobic Distance"],
      ...weekly.days.map((day) => [
        day.date,
        day.nutrition.calories,
        day.training.calories,
        day.netCalories,
        day.nutrition.protein,
        day.nutrition.carbs,
        day.nutrition.fat,
        day.nutrition.fiber,
        day.training.strengthVolume,
        day.training.durationMinutes,
        day.training.distanceKm
      ])
    ],
    "Food Details": [
      ["Date", "Meal", "Food", "Serving Grams", ...NUTRIENT_KEYS, "Source"],
      ...foodEntries.map((entry) => {
        const calculated = calculateFoodEntryNutrition(entry);
        return [
          entry.date,
          entry.meal || "",
          entry.name || "",
          entry.grams || 0,
          ...NUTRIENT_KEYS.map((key) => calculated.totals[key]),
          entry.source || "manual"
        ];
      })
    ],
    "Training Details": [
      ["Date", "Category", "Activity Or Exercise", "Muscle Group", "Sets", "Reps", "Weight", "Duration", "Distance", "Intensity", "Volume", "Estimated Calories", "Notes"],
      ...trainingSessions.flatMap((session) => sessionToRows(session))
    ],
    "Nutrition Stats": [
      ["Date", ...NUTRIENT_KEYS],
      ...weekly.days.map((day) => [day.date, ...NUTRIENT_KEYS.map((key) => day.nutrition[key])])
    ],
    "Weekly Report Data": [
      ["Date", "Calorie Intake", "Training Calories", "Net Calories", "Protein", "Strength Volume", "Aerobic Distance"],
      ...weekly.days.map((day) => [
        day.date,
        day.nutrition.calories,
        day.training.calories,
        day.netCalories,
        day.nutrition.protein,
        day.training.strengthVolume,
        day.training.distanceKm
      ])
    ]
  };
}
```

In the same file, implement these helper functions used by `createWorkbookBlobParts()` and `createWorkbookBuffer()`: `xmlEscape(value)`, `cellRef(rowIndex, columnIndex)`, `sheetXml(rows)`, `workbookXml(sheetNames)`, `workbookRelsXml(sheetNames)`, `contentTypesXml(sheetNames)`, `crc32(buffer)`, `dosDateTime(date)`, `createZip(files)`, and `toUint8Array(value)`. The ZIP writer outputs no-compression ZIP entries beginning with `PK` and includes `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, and one `xl/worksheets/sheetN.xml` per sheet.

- [ ] **Step 4: Run Excel export tests**

Run: `npm test`

Expected: PASS for all domain and export tests.

### Task 6: IndexedDB Storage

**Files:**
- Create: `src/storage/db.js`

- [ ] **Step 1: Implement database wrapper**

Create `src/storage/db.js` with:

```js
const DB_NAME = "fitness-tracker-pwa";
const DB_VERSION = 1;
const STORES = ["foodEntries", "trainingSessions", "settings"];

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          if (storeName !== "settings") {
            store.createIndex("date", "date");
            store.createIndex("updatedAt", "updatedAt");
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listRecords(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result.filter((record) => !record.deletedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecord(storeName, record) {
  const db = await openDatabase();
  const now = new Date().toISOString();
  const saved = {
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || now,
    updatedAt: now,
    schemaVersion: 1,
    syncStatus: "local"
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(saved);
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error);
  });
}

export async function softDeleteRecord(storeName, id) {
  const db = await openDatabase();
  const records = await listRecords(storeName);
  const record = records.find((item) => item.id === id);
  if (!record) return;
  return saveRecord(storeName, { ...record, deletedAt: new Date().toISOString() });
}
```

- [ ] **Step 2: Browser smoke check**

Run local server: `npm run serve`

Expected: static server exposes `http://localhost:4173`.

Open the app and run a manual browser smoke check after UI implementation in Task 8 because IndexedDB cannot be tested with Node's built-in test environment.

### Task 7: Sample Data

**Files:**
- Create: `src/sampleData.js`

- [ ] **Step 1: Create sample records**

Add `src/sampleData.js` exporting:

```js
export const defaultSettings = {
  bodyWeightKg: 70,
  calorieGoal: 2400,
  calorieGoalBand: { min: 250, max: 400, label: "增肌期" },
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

export const sampleFoodEntries = [
  {
    id: "sample-food-1",
    date: "2026-06-04",
    meal: "breakfast",
    name: "燕麦鸡蛋早餐",
    grams: 260,
    source: "template",
    nutrientsPer100g: { calories: 155, protein: 9.6, carbs: 18, fat: 5.2, fiber: 2.6, sodium: 140, calcium: 75, iron: 1.8, magnesium: 52, potassium: 210, zinc: 1.2, vitaminA: 80, vitaminC: 0, vitaminD: 1.2, vitaminB12: 0.5 }
  },
  {
    id: "sample-food-2",
    date: "2026-06-04",
    meal: "lunch",
    name: "鸡胸糙米饭",
    grams: 420,
    source: "template",
    nutrientsPer100g: { calories: 168, protein: 13.5, carbs: 20, fat: 3.1, fiber: 1.8, sodium: 220, calcium: 28, iron: 1.1, magnesium: 44, potassium: 260, zinc: 1.0, vitaminA: 35, vitaminC: 8, vitaminD: 0, vitaminB12: 0.2 }
  },
  {
    id: "sample-food-3",
    date: "2026-06-04",
    meal: "dinner",
    name: "三文鱼蔬菜",
    grams: 360,
    source: "template",
    nutrientsPer100g: { calories: 190, protein: 16, carbs: 6, fat: 11, fiber: 2.2, sodium: 180, calcium: 46, iron: 0.9, magnesium: 38, potassium: 390, zinc: 0.8, vitaminA: 220, vitaminC: 22, vitaminD: 5, vitaminB12: 1.6 }
  }
];

export const sampleTrainingSessions = [
  {
    id: "sample-training-1",
    date: "2026-06-04",
    category: "strength",
    activityType: "strength",
    durationMinutes: 55,
    bodyWeightKg: 70,
    intensity: "moderate",
    exercises: [
      { name: "深蹲", muscleGroup: "腿", equipment: "杠铃", sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
      { name: "卧推", muscleGroup: "胸", equipment: "杠铃", sets: [{ reps: 6, weight: 55 }, { reps: 6, weight: 55 }, { reps: 6, weight: 55 }, { reps: 6, weight: 55 }] }
    ]
  },
  {
    id: "sample-training-2",
    date: "2026-06-04",
    category: "outdoor",
    activityType: "running",
    durationMinutes: 32,
    distanceKm: 5.2,
    bodyWeightKg: 70,
    intensity: "moderate",
    notes: "轻松跑"
  }
];
```

- [ ] **Step 2: Use sample data only on first run**

During Task 8, import these records and seed IndexedDB only when both `foodEntries` and `trainingSessions` return empty arrays from `listRecords()`.

### Task 8: App UI And Interaction

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Implement application state**

In `src/app.js`, import domain, export, storage, and sample data modules. Track:

```js
const state = {
  activeTab: "overview",
  selectedDate: new Date().toISOString().slice(0, 10),
  foodEntries: [],
  trainingSessions: [],
  settings: null
};
```

- [ ] **Step 2: Load and seed data**

Implement `loadApp()` that reads IndexedDB, seeds sample records if empty, and calls `renderApp()`.

- [ ] **Step 3: Render bottom tabs**

Render tabs for Overview, Food, Training, and Reports. Tab clicks update `state.activeTab` and rerender.

- [ ] **Step 4: Render Overview**

Use `buildDailySummary()` and `buildWeeklyReport()` to display calorie balance, macro cards, micronutrient progress bars, training load, recent entries, and a weekly mini chart.

- [ ] **Step 5: Render Food page**

Provide a compact manual entry form for date, meal, food name, grams, calories, protein, carbs, fat, fiber, sodium, calcium, iron, magnesium, potassium, zinc, vitamin C, and source. On submit, save to `foodEntries` through IndexedDB and rerender.

- [ ] **Step 6: Render Training page**

Provide forms for:

- Strength: exercise name, muscle group, reps, weight, set count, duration.
- Outdoor/Other: activity type, duration, distance, intensity.

Save records to `trainingSessions` and rerender.

- [ ] **Step 7: Render Reports page**

Render weekly chart sections using inline SVG bars/lines from `buildWeeklyReport()` series.

- [ ] **Step 8: Implement Excel download**

Use `buildExportRows()` and workbook buffer/blob output to trigger a download named `fitness-report-YYYY-MM-DD.xlsx`.

- [ ] **Step 9: Implement delete actions**

Add delete buttons for food and training entries. Use soft deletes and rerender.

- [ ] **Step 10: Complete responsive styling**

Use restrained professional colors, compact cards, stable chart dimensions, and fixed-height controls. Ensure text does not overflow on 360px-wide screens.

### Task 9: Service Worker Asset Completion

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Add all created app assets to cache**

Update `APP_ASSETS` to include every static module:

```js
"./src/domain/nutrition.js",
"./src/domain/training.js",
"./src/domain/reports.js",
"./src/export/xlsx.js",
"./src/storage/db.js",
"./src/sampleData.js"
```

- [ ] **Step 2: Browser reload check**

Run the app with `npm run serve`, load it once, reload, and verify the app still renders.

### Task 10: Verification

**Files:**
- Read/verify all implementation files.

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run local static server**

Run: `npm run serve`

Expected: `Serving HTTP on :: port 4173` or equivalent.

- [ ] **Step 3: Browser desktop/mobile verification**

Open `http://localhost:4173` in the in-app browser. Use a mobile viewport around 390px width. Verify:

- Overview renders the professional dashboard.
- Food entry form saves and updates totals.
- Training entry form saves and updates training load.
- Reports page renders charts.
- Excel export downloads or produces a Blob with `.xlsx` MIME type.
- Reload preserves records from IndexedDB.

- [ ] **Step 4: Final file status**

Run: `git status --short` if a git repository exists. If not, report that the workspace is not a git repository.

## Plan Self-Review

- Spec coverage: MVP PWA shell, local-first storage, food recording, training recording, calculations, reports, Excel export, PWA offline basics, and AI future-entry treatment are covered.
- Ambiguity scan: no task relies on undefined future work; AI is explicitly a non-blocking future feature card.
- Type consistency: food entries use `date`, `meal`, `name`, `grams`, and `nutrientsPer100g`; training sessions use `date`, `category`, `activityType`, `durationMinutes`, `distanceKm`, `bodyWeightKg`, `intensity`, and `exercises`.
