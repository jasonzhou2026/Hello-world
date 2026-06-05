import { buildDailySummary, buildWeeklyReport } from "./domain/reports.js";
import { addDays } from "./domain/nutrition.js";
import { buildExportRows, createWorkbookBlobParts, XLSX_MIME_TYPE } from "./export/xlsx.js";
import { listRecords, saveRecord, softDeleteRecord } from "./storage/db.js";
import { defaultSettings, sampleFoodEntries, sampleTrainingSessions } from "./sampleData.js";

const SAMPLE_DATE = "2026-06-04";
const appRoot = typeof document !== "undefined" ? document.querySelector("#app") : null;
const defaultStorageAdapters = { listRecords, saveRecord, softDeleteRecord };
const storageAdapters = { ...defaultStorageAdapters };

export const state = {
  activeTab: "overview",
  selectedDate: getLocalDateString(new Date()),
  foodEntries: [],
  trainingSessions: [],
  settings: null,
  errorMessage: null
};

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "food", label: "Food" },
  { id: "training", label: "Training" },
  { id: "reports", label: "Reports" }
];

export const mealOptions = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "pre-workout",
  "post-workout",
  "custom"
];
const activities = [
  "running",
  "cycling",
  "walking",
  "hiking",
  "hiit",
  "yoga",
  "mobility",
  "swimming",
  "rowing",
  "other"
];
const intensities = ["light", "moderate", "hard"];
const macroKeys = ["protein", "carbs", "fat"];
const micronutrientKeys = [
  "calcium",
  "iron",
  "magnesium",
  "potassium",
  "zinc",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminB12",
  "sodium",
  "fiber"
];
const nutrientLabels = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
  fiber: "Fiber",
  sodium: "Sodium",
  calcium: "Calcium",
  iron: "Iron",
  magnesium: "Magnesium",
  potassium: "Potassium",
  zinc: "Zinc",
  vitaminA: "Vitamin A",
  vitaminC: "Vitamin C",
  vitaminD: "Vitamin D",
  vitaminB12: "Vitamin B12"
};
const nutrientUnits = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fiber: "g",
  sodium: "mg",
  calcium: "mg",
  iron: "mg",
  magnesium: "mg",
  potassium: "mg",
  zinc: "mg",
  vitaminA: "mcg",
  vitaminC: "mg",
  vitaminD: "mcg",
  vitaminB12: "mcg"
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getWeekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildStrengthSessionRecord(values) {
  const setCount = Math.max(1, Math.round(toNumber(values.setCount, 1)));
  const reps = toNumber(values.reps);
  const weight = toNumber(values.weight);

  return {
    date: values.date,
    category: "strength",
    activityType: "strength",
    durationMinutes: toNumber(values.durationMinutes),
    bodyWeightKg: toNumber(values.bodyWeightKg, 70),
    intensity: values.intensity || "moderate",
    exercises: [
      {
        name: String(values.exerciseName || "Strength exercise").trim(),
        muscleGroup: String(values.muscleGroup || "").trim(),
        sets: Array.from({ length: setCount }, () => ({ reps, weight }))
      }
    ]
  };
}

export function resolveDefaultSettingsRecord(settingsRecords = []) {
  const settings = settingsRecords.find((record) => record.id === "default") || null;
  return {
    settings,
    shouldCreateDefault: !settings
  };
}

export function shouldSeedSamples({ foodEntries = [], trainingSessions = [], settings = null } = {}) {
  return (
    foodEntries.length === 0 &&
    trainingSessions.length === 0 &&
    settings?.samplesSeeded !== true
  );
}

export function configureStorageAdapters(overrides = {}) {
  Object.assign(storageAdapters, overrides);
}

export function resetStorageAdapters() {
  Object.assign(storageAdapters, defaultStorageAdapters);
}

export async function loadApp() {
  let [foodEntries, trainingSessions, settingsRecords] = await Promise.all([
    storageAdapters.listRecords("foodEntries"),
    storageAdapters.listRecords("trainingSessions"),
    storageAdapters.listRecords("settings")
  ]);

  const settingsResolution = resolveDefaultSettingsRecord(settingsRecords);
  let settings = settingsResolution.settings;
  if (settingsResolution.shouldCreateDefault) {
    settings = await storageAdapters.saveRecord("settings", { id: "default", ...deepClone(defaultSettings) });
  }

  if (shouldSeedSamples({ foodEntries, trainingSessions, settings })) {
    const seededFood = await Promise.all(
      sampleFoodEntries.map((entry) => storageAdapters.saveRecord("foodEntries", deepClone(entry)))
    );
    const seededTraining = await Promise.all(
      sampleTrainingSessions.map((session) => storageAdapters.saveRecord("trainingSessions", deepClone(session)))
    );
    foodEntries = seededFood;
    trainingSessions = seededTraining;
    state.selectedDate = SAMPLE_DATE;
    settings = await storageAdapters.saveRecord("settings", { ...settings, samplesSeeded: true });
  } else if (settings.samplesSeeded !== true && (foodEntries.length > 0 || trainingSessions.length > 0)) {
    settings = await storageAdapters.saveRecord("settings", { ...settings, samplesSeeded: true });
  }

  state.foodEntries = foodEntries;
  state.trainingSessions = trainingSessions;
  state.settings = settings;
  state.errorMessage = null;
  renderApp();
}

export function renderApp() {
  if (!appRoot) return;

  appRoot.innerHTML = `
    <div class="app-view">
      ${renderActiveTab()}
      ${renderTabs()}
    </div>
  `;
}

function renderActiveTab() {
  if (!state.settings) {
    return `<section class="screen"><h1>Training and nutrition</h1><p>Loading your records.</p></section>`;
  }

  if (state.activeTab === "food") return renderFoodPage();
  if (state.activeTab === "training") return renderTrainingPage();
  if (state.activeTab === "reports") return renderReportsPage();
  return renderOverviewPage();
}

function renderOverviewPage() {
  const summary = buildDailySummary({
    date: state.selectedDate,
    foodEntries: state.foodEntries,
    trainingSessions: state.trainingSessions
  });
  const weekStart = getWeekStart(state.selectedDate);
  const weekly = buildWeeklyReport({
    weekStart,
    foodEntries: state.foodEntries,
    trainingSessions: state.trainingSessions
  });
  const goalBand = state.settings.calorieGoalBand || { min: 0, max: 0, label: "goal" };
  const netGoal = Number(state.settings.calorieGoal) || 0;
  const bandMin = netGoal + (Number(goalBand.min) || 0);
  const bandMax = netGoal + (Number(goalBand.max) || 0);
  const balance = summary.netCalories - netGoal;
  const selectedFood = recordsForDate(state.foodEntries, state.selectedDate);
  const selectedTraining = recordsForDate(state.trainingSessions, state.selectedDate);

  return `
    <section class="screen">
      ${renderTopbar("Daily overview", `<button class="ghost-button" type="button" data-action="download-xlsx">Export</button>`)}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <div class="metric-grid">
        ${metricCard("Balance", formatSigned(balance, "kcal"), "Net calories vs daily goal")}
        ${metricCard("Intake", formatNumber(summary.nutrition.calories), "kcal from food")}
        ${metricCard("Training", formatNumber(summary.training.calories), "kcal estimated")}
        ${metricCard("Net", formatNumber(summary.netCalories), `Goal band ${formatNumber(bandMin)}-${formatNumber(bandMax)}`)}
      </div>
      <section class="section-block">
        <div class="section-heading">
          <h2>Macros</h2>
          <span>${escapeHtml(goalBand.label || "goal band")}</span>
        </div>
        <div class="progress-card-grid">
          ${macroKeys.map((key) => renderProgressCard(key, summary.nutrition[key], state.settings.macroTargets?.[key])).join("")}
        </div>
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Micronutrients</h2>
          <span>Daily targets</span>
        </div>
        <div class="micro-grid">
          ${micronutrientKeys.map((key) => renderMicroProgress(key, summary.nutrition[key], state.settings.micronutrientTargets?.[key])).join("")}
        </div>
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Training load</h2>
          <span>${formatNumber(summary.training.durationMinutes)} min</span>
        </div>
        <div class="metric-grid compact">
          ${metricCard("Strength volume", formatNumber(summary.training.strengthVolume), "kg x reps")}
          ${metricCard("Total sets", formatNumber(summary.training.totalSets), "sets")}
          ${metricCard("Aerobic distance", `${formatNumber(summary.training.distanceKm)} km`, "outdoor and other")}
          ${metricCard("Duration", `${formatNumber(summary.training.durationMinutes)} min`, "all sessions")}
        </div>
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Recent food</h2>
          <span>${selectedFood.length} entries</span>
        </div>
        ${renderSnippetList(selectedFood, renderFoodSnippet)}
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Recent training</h2>
          <span>${selectedTraining.length} sessions</span>
        </div>
        ${renderSnippetList(selectedTraining, renderTrainingSnippet)}
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Week at a glance</h2>
          <span>${escapeHtml(weekStart)}</span>
        </div>
        ${renderMiniWeeklyChart(weekly)}
      </section>
    </section>
  `;
}

function renderFoodPage() {
  const selectedFood = recordsForDate(state.foodEntries, state.selectedDate);

  return `
    <section class="screen">
      ${renderTopbar("Food log", `<button class="ghost-button" type="button" data-action="download-xlsx">Export</button>`)}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <form class="entry-form" data-form="food">
        <div class="form-grid">
          ${inputField("Date", "date", "date", state.selectedDate)}
          ${selectField("Meal", "meal", mealOptions, "lunch")}
          ${inputField("Food name", "name", "text", "", { required: true, placeholder: "Chicken rice" })}
          ${inputField("Grams", "grams", "number", "100", { required: true, min: "0", step: "1" })}
          ${inputField("Calories", "calories", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Protein", "protein", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Carbs", "carbs", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Fat", "fat", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Fiber", "fiber", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Sugar", "sugar", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Sodium", "sodium", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Calcium", "calcium", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Iron", "iron", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Magnesium", "magnesium", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Potassium", "potassium", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Zinc", "zinc", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Vitamin A", "vitaminA", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Vitamin C", "vitaminC", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Vitamin D", "vitaminD", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Vitamin B12", "vitaminB12", "number", "", { min: "0", step: "0.1" })}
          ${inputField("Source", "source", "text", "manual")}
        </div>
        <button class="primary-button" type="submit">Add food</button>
      </form>
      <ul class="record-list">
        ${selectedFood.length ? selectedFood.map(renderFoodListItem).join("") : emptyState("No food entries for this date.")}
      </ul>
    </section>
  `;
}

function renderTrainingPage() {
  const selectedTraining = recordsForDate(state.trainingSessions, state.selectedDate);

  return `
    <section class="screen">
      ${renderTopbar("Training log", `<button class="ghost-button" type="button" data-action="download-xlsx">Export</button>`)}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <div class="form-stack">
        <form class="entry-form" data-form="strength">
          <div class="form-heading">
            <h2>Strength</h2>
          </div>
          <div class="form-grid">
            ${inputField("Date", "date", "date", state.selectedDate)}
            ${inputField("Exercise", "exerciseName", "text", "", { required: true, placeholder: "Squat" })}
            ${inputField("Muscle group", "muscleGroup", "text", "", { placeholder: "Legs" })}
            ${inputField("Reps", "reps", "number", "5", { min: "0", step: "1" })}
            ${inputField("Weight", "weight", "number", "0", { min: "0", step: "0.5" })}
            ${inputField("Set count", "setCount", "number", "3", { min: "1", step: "1" })}
            ${inputField("Duration", "durationMinutes", "number", "45", { min: "0", step: "1" })}
          </div>
          <button class="primary-button" type="submit">Add strength</button>
        </form>
        <form class="entry-form" data-form="activity">
          <div class="form-heading">
            <h2>Outdoor / other</h2>
          </div>
          <div class="form-grid">
            ${inputField("Date", "date", "date", state.selectedDate)}
            ${selectField("Activity", "activityType", activities, "running")}
            ${inputField("Duration", "durationMinutes", "number", "30", { min: "0", step: "1" })}
            ${inputField("Distance km", "distanceKm", "number", "", { min: "0", step: "0.01" })}
            ${selectField("Intensity", "intensity", intensities, "moderate")}
            ${textareaField("Notes", "notes", "")}
          </div>
          <button class="primary-button" type="submit">Add activity</button>
        </form>
      </div>
      <ul class="record-list">
        ${selectedTraining.length ? selectedTraining.map(renderTrainingListItem).join("") : emptyState("No training sessions for this date.")}
      </ul>
    </section>
  `;
}

function renderReportsPage() {
  const weekStart = getWeekStart(state.selectedDate);
  const report = buildWeeklyReport({
    weekStart,
    foodEntries: state.foodEntries,
    trainingSessions: state.trainingSessions
  });

  return `
    <section class="screen">
      ${renderTopbar("Weekly reports", `<button class="ghost-button" type="button" data-action="download-xlsx">Export</button>`)}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <div class="reports-grid">
        ${renderDualBarChart("Calorie intake vs training", report.series.dates, report.series.calorieIntake, report.series.trainingCalories, "Intake", "Training", "kcal")}
        ${renderBarChart("Net calorie balance", report.series.dates, report.series.netCalories, "kcal", "bar-net")}
        ${renderBarChart("Protein by day", report.series.dates, report.series.protein, "g", "bar-protein")}
        ${renderBarChart("Strength volume by day", report.series.dates, report.series.strengthVolume, "kg x reps", "bar-strength")}
        ${renderBarChart("Aerobic distance by day", report.series.dates, report.series.aerobicDistance, "km", "bar-distance")}
        ${renderBarChart("Aerobic duration", report.series.dates, report.days.map((day) => day.training.durationMinutes), "min", "bar-duration")}
        ${renderMacronutrientSummary(report, state.settings)}
        ${renderMicronutrientSummary(report, state.settings)}
      </div>
      <section class="ai-card" aria-disabled="true">
        <span>Future feature</span>
        <h2>AI coaching summary</h2>
        <p>Planned analysis will explain nutrition gaps and training trends from your local records. It is not active in this offline build.</p>
      </section>
    </section>
  `;
}

function renderTabs() {
  return `
    <nav class="bottom-tabs" aria-label="Primary">
      ${tabs
        .map(
          (tab) => `
            <button type="button" data-tab="${tab.id}" aria-current="${state.activeTab === tab.id ? "page" : "false"}">
              ${escapeHtml(tab.label)}
            </button>
          `
        )
        .join("")}
    </nav>
  `;
}

function renderTopbar(title, action = "") {
  return `
    <header class="topbar">
      <h1>${escapeHtml(title)}</h1>
      <div class="topbar-actions">${action}</div>
    </header>
  `;
}

function renderErrorBanner() {
  if (!state.errorMessage) return "";
  return `<div class="error-banner" role="alert">${escapeHtml(state.errorMessage)}</div>`;
}

function renderDateTools() {
  return `
    <div class="date-tools">
      <button type="button" class="icon-button" data-date-shift="-1" aria-label="Previous day">&lt;</button>
      <label>
        <span>Selected date</span>
        <input type="date" value="${escapeHtml(state.selectedDate)}" data-date-input />
      </label>
      <button type="button" class="icon-button" data-date-shift="1" aria-label="Next day">&gt;</button>
    </div>
  `;
}

function metricCard(label, value, hint) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(hint)}</small>
    </article>
  `;
}

function renderProgressCard(key, value, target) {
  const percent = progressPercent(value, target);
  return `
    <article class="progress-card">
      <div>
        <span>${escapeHtml(nutrientLabels[key] || key)}</span>
        <strong>${formatNumber(value)} / ${formatNumber(target)} ${escapeHtml(nutrientUnits[key] || "")}</strong>
      </div>
      ${progressBar(percent)}
    </article>
  `;
}

function renderMicroProgress(key, value, target) {
  const percent = progressPercent(value, target);
  return `
    <article class="micro-row">
      <div>
        <span>${escapeHtml(nutrientLabels[key] || key)}</span>
        <strong>${formatNumber(value)} / ${formatNumber(target)} ${escapeHtml(nutrientUnits[key] || "")}</strong>
      </div>
      ${progressBar(percent)}
    </article>
  `;
}

function progressBar(percent) {
  return `<div class="progress-bar" aria-hidden="true"><span style="--progress: ${percent}%"></span></div>`;
}

function renderSnippetList(records, renderer) {
  if (records.length === 0) return `<ul class="snippet-list">${emptyState("Nothing logged yet.")}</ul>`;
  return `<ul class="snippet-list">${records.slice(0, 3).map((record) => `<li>${renderer(record)}</li>`).join("")}</ul>`;
}

function renderFoodSnippet(entry) {
  return `
    <span>${escapeHtml(entry.meal || "meal")}</span>
    <strong>${escapeHtml(entry.name || "Food")}</strong>
    <small>${formatNumber(entry.grams)} g</small>
  `;
}

function renderTrainingSnippet(session) {
  return `
    <span>${escapeHtml(session.category || session.activityType || "training")}</span>
    <strong>${escapeHtml(trainingTitle(session))}</strong>
    <small>${formatNumber(session.durationMinutes)} min</small>
  `;
}

function renderMiniWeeklyChart(report) {
  const max = Math.max(1, ...report.series.netCalories.map((value) => Math.abs(value)));
  return `
    <div class="mini-chart" role="img" aria-label="Weekly net calories">
      ${report.days
        .map((day) => {
          const height = Math.max(8, Math.round((Math.abs(day.netCalories) / max) * 96));
          const tone = day.netCalories >= 0 ? "positive" : "negative";
          return `
            <div class="mini-day">
              <span class="mini-bar ${tone}" style="height: ${height}px"></span>
              <small>${escapeHtml(day.date.slice(5))}</small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderFoodListItem(entry) {
  return `
    <li>
      <div class="record-main">
        <span>${escapeHtml(entry.meal || "meal")}</span>
        <strong>${escapeHtml(entry.name || "Food")}</strong>
        <small>${formatNumber(entry.grams)} g - ${formatNumber(entry.nutrientsPer100g?.calories)} kcal/100g</small>
      </div>
      <button class="delete-button" type="button" data-delete-store="foodEntries" data-id="${escapeHtml(entry.id)}">Delete</button>
    </li>
  `;
}

function renderTrainingListItem(session) {
  return `
    <li>
      <div class="record-main">
        <span>${escapeHtml(session.category || session.activityType || "training")}</span>
        <strong>${escapeHtml(trainingTitle(session))}</strong>
        <small>${formatNumber(session.durationMinutes)} min - ${formatNumber(session.distanceKm)} km</small>
      </div>
      <button class="delete-button" type="button" data-delete-store="trainingSessions" data-id="${escapeHtml(session.id)}">Delete</button>
    </li>
  `;
}

export function renderMacronutrientSummary(report, settings = {}) {
  const totals = macroKeys.map((key) => ({
    key,
    value: sumReportNutrition(report, key),
    target: (Number(settings?.macroTargets?.[key]) || 0) * Math.max(1, report.days?.length || 0)
  }));
  const totalMacros = Math.max(1, totals.reduce((total, item) => total + item.value, 0));

  return `
    <section class="chart-card summary-card">
      <h2>Macronutrient split</h2>
      <div class="summary-list">
        ${totals
          .map((item) => {
            const share = Math.round((item.value / totalMacros) * 100);
            const percent = progressPercent(item.value, item.target);
            return `
              <div class="summary-row">
                <div>
                  <span>${escapeHtml(nutrientLabels[item.key] || item.key)}</span>
                  <strong>${formatNumber(item.value)} ${escapeHtml(nutrientUnits[item.key])} - ${share}%</strong>
                </div>
                ${progressBar(percent)}
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderMicronutrientSummary(report, settings = {}) {
  const dayCount = Math.max(1, report.days?.length || 0);

  return `
    <section class="chart-card summary-card">
      <h2>Micronutrient completion</h2>
      <div class="summary-list micro-summary">
        ${micronutrientKeys
          .map((key) => {
            const value = sumReportNutrition(report, key);
            const target = (Number(settings?.micronutrientTargets?.[key]) || 0) * dayCount;
            const percent = progressPercent(value, target);
            return `
              <div class="summary-row">
                <div>
                  <span>${escapeHtml(nutrientLabels[key] || key)}</span>
                  <strong>${formatNumber(percent)}%</strong>
                </div>
                ${progressBar(percent)}
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

export function renderBarChart(title, labels, values, unit, className) {
  const max = Math.max(1, ...values.map((value) => Math.abs(Number(value) || 0)));
  const width = 420;
  const height = 188;
  const plotTop = 14;
  const plotHeight = 112;
  const hasNegativeValues = values.some((value) => (Number(value) || 0) < 0);
  const baseline = hasNegativeValues ? plotTop + Math.round(plotHeight / 2) : plotTop + plotHeight;
  const signedPlotHeight = hasNegativeValues ? Math.round(plotHeight / 2) : plotHeight;
  const groupWidth = width / Math.max(1, labels.length);
  const barWidth = Math.min(24, groupWidth * 0.42);

  return `
    <section class="chart-card">
      <h2>${escapeHtml(title)}</h2>
      <svg class="report-svg" role="img" aria-label="${escapeHtml(title)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <title>${escapeHtml(title)}</title>
        <desc>${labels.map((label, index) => `${label.slice(5)} ${formatNumber(values[index])} ${unit}`).map(escapeHtml).join("; ")}</desc>
        <line class="svg-axis" x1="0" y1="${baseline}" x2="${width}" y2="${baseline}"></line>
        ${labels
          .map((label, index) => {
            const value = Number(values[index]) || 0;
            const barHeight = value !== 0 ? Math.max(3, Math.round((Math.abs(value) / max) * signedPlotHeight)) : 0;
            const x = Math.round(index * groupWidth + (groupWidth - barWidth) / 2);
            const y = value < 0 ? baseline : baseline - barHeight;
            return `
              <rect class="${escapeHtml(className)}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
              <text class="svg-label" x="${Math.round(index * groupWidth + groupWidth / 2)}" y="148" text-anchor="middle">${escapeHtml(label.slice(5))}</text>
            `;
          })
          .join("")}
      </svg>
    </section>
  `;
}

function sumReportNutrition(report, key) {
  return (report.days || []).reduce((total, day) => total + (Number(day.nutrition?.[key]) || 0), 0);
}

export function renderDualBarChart(title, labels, firstValues, secondValues, firstLabel, secondLabel, unit) {
  const max = Math.max(1, ...firstValues, ...secondValues);
  const width = 420;
  const height = 188;
  const plotTop = 14;
  const plotHeight = 112;
  const baseline = plotTop + plotHeight;
  const groupWidth = width / Math.max(1, labels.length);
  const barWidth = Math.min(13, groupWidth * 0.22);
  const gap = 4;

  return `
    <section class="chart-card">
      <div class="section-heading">
        <h2>${escapeHtml(title)}</h2>
        <span>${escapeHtml(firstLabel)} / ${escapeHtml(secondLabel)}</span>
      </div>
      <svg class="report-svg" role="img" aria-label="${escapeHtml(title)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <title>${escapeHtml(title)}</title>
        <desc>${labels
          .map(
            (label, index) =>
              `${label.slice(5)} ${firstLabel} ${formatNumber(firstValues[index])} ${unit}, ${secondLabel} ${formatNumber(secondValues[index])} ${unit}`
          )
          .map(escapeHtml)
          .join("; ")}</desc>
        <line class="svg-axis" x1="0" y1="${baseline}" x2="${width}" y2="${baseline}"></line>
        ${labels
          .map((label, index) => {
            const firstValue = Number(firstValues[index]) || 0;
            const secondValue = Number(secondValues[index]) || 0;
            const firstHeight = firstValue > 0 ? Math.max(3, Math.round((firstValue / max) * plotHeight)) : 0;
            const secondHeight = secondValue > 0 ? Math.max(3, Math.round((secondValue / max) * plotHeight)) : 0;
            const center = Math.round(index * groupWidth + groupWidth / 2);
            const firstX = Math.round(center - barWidth - gap / 2);
            const secondX = Math.round(center + gap / 2);
            return `
              <rect class="bar-intake" x="${firstX}" y="${baseline - firstHeight}" width="${barWidth}" height="${firstHeight}" rx="4"></rect>
              <rect class="bar-training" x="${secondX}" y="${baseline - secondHeight}" width="${barWidth}" height="${secondHeight}" rx="4"></rect>
              <text class="svg-label" x="${center}" y="148" text-anchor="middle">${escapeHtml(label.slice(5))}</text>
            `;
          })
          .join("")}
      </svg>
    </section>
  `;
}

function inputField(label, name, type, value, options = {}) {
  const attrs = Object.entries(options)
    .map(([key, optionValue]) => `${key}="${escapeHtml(optionValue)}"`)
    .join(" ");
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${attrs} />
    </label>
  `;
}

function selectField(label, name, options, selected) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function textareaField(label, name, value) {
  return `
    <label class="wide-field">
      <span>${escapeHtml(label)}</span>
      <textarea name="${escapeHtml(name)}" rows="2">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function emptyState(message) {
  return `<li class="empty-state">${escapeHtml(message)}</li>`;
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;

  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const formType = form.dataset.form;

    if (formType === "food") {
      const saved = await storageAdapters.saveRecord("foodEntries", buildFoodEntryRecord(values));
      state.foodEntries = [...state.foodEntries, saved];
      state.selectedDate = saved.date;
    }

    if (formType === "strength") {
      const saved = await storageAdapters.saveRecord(
        "trainingSessions",
        buildStrengthSessionRecord({
          ...values,
          bodyWeightKg: state.settings?.bodyWeightKg
        })
      );
      state.trainingSessions = [...state.trainingSessions, saved];
      state.selectedDate = saved.date;
    }

    if (formType === "activity") {
      const saved = await storageAdapters.saveRecord("trainingSessions", buildActivitySessionRecord(values));
      state.trainingSessions = [...state.trainingSessions, saved];
      state.selectedDate = saved.date;
    }

    state.errorMessage = null;
    renderApp();
  } catch (error) {
    console.warn("Record save failed.", error);
    state.errorMessage = "Could not save the record. Please try again.";
    renderApp();
  }
}

export function bindAppInteractions(root) {
  if (!root) return;
  root.addEventListener("submit", handleSubmit);
  root.addEventListener("click", handleClick);
  root.addEventListener("change", handleChange);
}

async function handleClick(event) {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    state.activeTab = tabButton.dataset.tab;
    renderApp();
    return;
  }

  const dateShift = event.target.closest("[data-date-shift]");
  if (dateShift) {
    state.selectedDate = addDays(state.selectedDate, Number(dateShift.dataset.dateShift) || 0);
    renderApp();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-store][data-id]");
  if (deleteButton) {
    const storeName = deleteButton.dataset.deleteStore;
    const id = deleteButton.dataset.id;
    try {
      await storageAdapters.softDeleteRecord(storeName, id);
      if (storeName === "foodEntries") {
        state.foodEntries = state.foodEntries.filter((entry) => entry.id !== id);
      }
      if (storeName === "trainingSessions") {
        state.trainingSessions = state.trainingSessions.filter((session) => session.id !== id);
      }
      state.errorMessage = null;
      renderApp();
    } catch (error) {
      console.warn("Record delete failed.", error);
      state.errorMessage = "Could not delete the record. Please try again.";
      renderApp();
    }
    return;
  }

  const downloadButton = event.target.closest('[data-action="download-xlsx"]');
  if (downloadButton) {
    downloadExcelReport();
  }
}

function handleChange(event) {
  if (event.target.matches("[data-date-input]")) {
    state.selectedDate = event.target.value || state.selectedDate;
    renderApp();
  }
}

export function buildFoodEntryRecord(values) {
  return {
    date: values.date,
    meal: values.meal || "meal",
    name: String(values.name || "Food").trim(),
    grams: toNumber(values.grams),
    source: String(values.source || "manual").trim(),
    nutrientsPer100g: {
      calories: toNumber(values.calories),
      protein: toNumber(values.protein),
      carbs: toNumber(values.carbs),
      fat: toNumber(values.fat),
      fiber: toNumber(values.fiber),
      sugar: toNumber(values.sugar),
      sodium: toNumber(values.sodium),
      calcium: toNumber(values.calcium),
      iron: toNumber(values.iron),
      magnesium: toNumber(values.magnesium),
      potassium: toNumber(values.potassium),
      zinc: toNumber(values.zinc),
      vitaminA: toNumber(values.vitaminA),
      vitaminC: toNumber(values.vitaminC),
      vitaminD: toNumber(values.vitaminD),
      vitaminB12: toNumber(values.vitaminB12)
    }
  };
}

function buildActivitySessionRecord(values) {
  return {
    date: values.date,
    category: values.activityType === "other" ? "other" : "outdoor",
    activityType: values.activityType || "other",
    durationMinutes: toNumber(values.durationMinutes),
    distanceKm: toNumber(values.distanceKm),
    bodyWeightKg: toNumber(state.settings?.bodyWeightKg, 70),
    intensity: values.intensity || "moderate",
    notes: String(values.notes || "").trim()
  };
}

function downloadExcelReport() {
  const weekStart = getWeekStart(state.selectedDate);
  const rows = buildExportRows({
    foodEntries: state.foodEntries,
    trainingSessions: state.trainingSessions,
    weekStart
  });
  const blob = new Blob(createWorkbookBlobParts(rows), { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitness-report-${weekStart}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function recordsForDate(records, date) {
  return records
    .filter((record) => record.date === date)
    .sort((a, b) => String(b.updatedAt || b.id).localeCompare(String(a.updatedAt || a.id)));
}

function trainingTitle(session) {
  const exercise = session.exercises?.[0]?.name;
  return exercise || session.name || session.activityType || session.category || "Training";
}

function progressPercent(value, target) {
  const safeTarget = Number(target) || 0;
  if (safeTarget <= 0) return 0;
  return Math.min(100, Math.round(((Number(value) || 0) / safeTarget) * 100));
}

function formatNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1000) return Math.round(number).toLocaleString("en-US");
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(1).replace(/\.0$/, "");
}

function formatSigned(value, unit) {
  const number = Number(value) || 0;
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${formatNumber(number)} ${unit}`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

if (appRoot) {
  appRoot.innerHTML = `
    <section class="screen">
      <h1>Training and nutrition</h1>
      <p>Application is initializing.</p>
    </section>
  `;
  bindAppInteractions(appRoot);
  loadApp().catch((error) => {
    console.warn("Application failed to load.", error);
    appRoot.innerHTML = `
      <section class="screen">
        <h1>Training and nutrition</h1>
        <p>Local data could not be loaded. Please refresh and try again.</p>
      </section>
    `;
  });
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./service-worker.js")
    .catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
}
