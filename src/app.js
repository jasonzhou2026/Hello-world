import { buildDailySummary, buildWeeklyReport } from "./domain/reports.js?v=25";
import { addDays } from "./domain/nutrition.js?v=25";
import { buildBackupPayload, parseBackupText } from "./domain/backup.js?v=25";
import { buildMuscleRecency, buildTrainingComparison } from "./domain/overview.js?v=25";
import { buildExportRows, createWorkbookBlobParts, XLSX_MIME_TYPE } from "./export/xlsx.js?v=25";
import { listRecords, saveRecord, softDeleteRecord } from "./storage/db.js?v=25";
import { defaultSettings, sampleFoodEntries, sampleTrainingSessions } from "./sampleData.js?v=25";

const SAMPLE_DATE = "2026-06-04";
const appRoot = typeof document !== "undefined" ? document.querySelector("#app") : null;
const defaultStorageAdapters = { listRecords, saveRecord, softDeleteRecord };
const storageAdapters = { ...defaultStorageAdapters };
let muscleMapCleanup = null;
let renderSequence = 0;

export const state = {
  activeTab: "overview",
  selectedDate: getLocalDateString(new Date()),
  foodEntries: [],
  trainingSessions: [],
  settings: null,
  errorMessage: null,
  statusMessage: null,
  editingFoodId: null,
  editingTrainingId: null,
  pendingCleanupRange: null,
  trainingMode: "strength",
  muscleView: "front"
};

const tabs = [
  { id: "overview", label: "Overview 总览" },
  { id: "food", label: "Food 食物" },
  { id: "training", label: "Training 训练" },
  { id: "reports", label: "Reports 报告" }
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
const strengthExerciseOptions = [
  "bench press 卧推",
  "squat 深蹲",
  "deadlift 硬拉",
  "shoulder press 推举",
  "row 划船",
  "pull-up 引体向上",
  "curl 弯举",
  "triceps pushdown 绳索下压",
  "leg press 腿举",
  "lunge 弓步",
  "plank 平板支撑"
];
const muscleGroupOptions = [
  "chest 胸",
  "back 背",
  "shoulders 肩",
  "biceps 二头",
  "triceps 三头",
  "core 核心",
  "glutes 臀",
  "quads 股四头",
  "hamstrings 腘绳肌",
  "calves 小腿",
  "full body 全身"
];
const handModeOptions = ["single 单重", "split 左右"];
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
const mineralKeys = ["calcium", "iron", "magnesium", "potassium", "zinc", "sodium", "fiber"];
const vitaminKeys = ["vitaminA", "vitaminC", "vitaminD", "vitaminB12"];
const nutrientLabels = {
  calories: "Calories 热量",
  protein: "Protein 蛋白",
  carbs: "Carbs 碳水",
  fat: "Fat 脂肪",
  fiber: "Fiber 膳食纤维",
  sodium: "Sodium 钠",
  calcium: "Calcium 钙",
  iron: "Iron 铁",
  magnesium: "Magnesium 镁",
  potassium: "Potassium 钾",
  zinc: "Zinc 锌",
  vitaminA: "Vitamin A 维A",
  vitaminC: "Vitamin C 维C",
  vitaminD: "Vitamin D 维D",
  vitaminB12: "Vitamin B12 维B12"
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
  const hasIndexedExercises = Array.from({ length: 3 }, (_, index) =>
    hasFormValue(values[`exerciseName${index + 1}`])
  ).some(Boolean);
  const exercises = hasIndexedExercises
    ? Array.from({ length: 3 }, (_, index) => buildStrengthExercise(values, index + 1)).filter(Boolean)
    : [
        {
          name: String(values.exerciseName || "Strength exercise").trim(),
          muscleGroup: String(values.muscleGroup || "").trim(),
          sets: buildStrengthSets(values)
        }
      ];

  return {
    date: values.date,
    category: "strength",
    activityType: "strength",
    durationMinutes: toNumber(values.durationMinutes),
    bodyWeightKg: toNumber(values.bodyWeightKg, 70),
    intensity: values.intensity || "moderate",
    handMode: hasIndexedExercises ? exercises[0]?.handMode || "single" : resolveHandMode(values.handMode),
    notes: String(values.notes || "").trim(),
    exercises
  };
}

function buildStrengthExercise(values, exerciseNumber) {
  const name = String(values[`exerciseName${exerciseNumber}`] || "").trim();
  if (!name) return null;
  const handMode = resolveHandMode(values[`handMode${exerciseNumber}`]);
  return {
    name,
    muscleGroup: String(values[`muscleGroup${exerciseNumber}`] || "").trim(),
    handMode,
    sets: buildStrengthSets(values, `e${exerciseNumber}`, handMode)
  };
}

function buildStrengthSets(values, prefix = "", handMode = resolveHandMode(values.handMode)) {
  const indexedSets = Array.from({ length: 6 }, (_, index) => {
    const setNumber = index + 1;
    const weightValue = values[`${prefix}weight${setNumber}`];
    const leftWeightValue = values[`${prefix}leftWeight${setNumber}`];
    const rightWeightValue = values[`${prefix}rightWeight${setNumber}`];
    const repsValue = values[`${prefix}reps${setNumber}`];
    const hasWeight = hasFormValue(weightValue);
    const hasLeftWeight = hasFormValue(leftWeightValue);
    const hasRightWeight = hasFormValue(rightWeightValue);
    const hasReps = hasFormValue(repsValue);

    if (!hasWeight && !hasLeftWeight && !hasRightWeight && !hasReps) return null;
    if (handMode === "split") {
      const leftWeight = hasLeftWeight ? toNumber(leftWeightValue) : 0;
      const rightWeight = hasRightWeight ? toNumber(rightWeightValue) : 0;
      return {
        weight: leftWeight + rightWeight,
        leftWeight,
        rightWeight,
        reps: hasReps ? toNumber(repsValue) : 0
      };
    }
    return {
      weight: hasWeight ? toNumber(weightValue) : 0,
      reps: hasReps ? toNumber(repsValue) : 0
    };
  }).filter(Boolean);

  if (indexedSets.length > 0) return indexedSets;

  const setCount = Math.max(1, Math.round(toNumber(values.setCount, 1)));
  const reps = toNumber(values.reps);
  const weight = toNumber(values.weight);
  return Array.from({ length: setCount }, () => ({ reps, weight }));
}

function resolveHandMode(value) {
  const normalized = String(value || "single").toLowerCase();
  return normalized.startsWith("split") || normalized.startsWith("double") ? "split" : "single";
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

  const sequence = ++renderSequence;
  muscleMapCleanup?.();
  muscleMapCleanup = null;

  appRoot.innerHTML = `
    <div class="app-view">
      ${renderActiveTab()}
      ${renderTabs()}
    </div>
  `;

  if (state.activeTab === "overview") {
    const canvas = appRoot.querySelector("#muscle-map-canvas");
    const muscleStates = buildMuscleRecency({
      date: state.selectedDate,
      trainingSessions: state.trainingSessions
    });
    import("./muscle-map.js?v=25")
      .then(({ mountMuscleMap }) => {
        if (sequence !== renderSequence || !canvas?.isConnected) return;
        muscleMapCleanup = mountMuscleMap(canvas, {
          muscleStates,
          view: state.muscleView
        });
      })
      .catch((error) => console.warn("Muscle map failed to load.", error));
  }
}

function renderActiveTab() {
  if (!state.settings) {
    return `<section class="screen"><h1>Training and nutrition</h1><p>Loading your records.</p></section>`;
  }

  if (state.activeTab === "food") return renderFoodPage();
  if (state.activeTab === "training") return renderTrainingPage();
  if (state.activeTab === "reports") return renderReportsPage();
  if (state.activeTab === "settings") return renderSettingsPage();
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
  const selectedFood = recordsForDate(state.foodEntries, state.selectedDate);
  const selectedTraining = recordsForDate(state.trainingSessions, state.selectedDate);
  const comparison = buildTrainingComparison({
    date: state.selectedDate,
    trainingSessions: state.trainingSessions,
    preferredExercise: state.settings.preferredExercise,
    preferredMuscleGroup: state.settings.preferredMuscleGroup
  });
  return `
    <section class="screen">
      ${renderTopbar("Overview 总览", renderSettingsButton())}
      ${renderErrorBanner()}
      ${renderStatusBanner()}
      ${renderDateTools()}
      ${renderGoalCard(comparison)}
      <div class="metric-grid">
        ${metricCard("Calories 热量", `${formatNumber(summary.nutrition.calories)} kcal`, `Goal 目标 ${formatNumber(netGoal)}`)}
        ${metricCard("Protein 蛋白", `${formatNumber(summary.nutrition.protein)} g`, `Goal 目标 ${formatNumber(state.settings.macroTargets?.protein)}`)}
        ${metricCard("Net 净热量", `${formatNumber(summary.netCalories)} kcal`, `Band 区间 ${formatNumber(bandMin)}-${formatNumber(bandMax)}`)}
        ${metricCard("Load 训练量", formatNumber(summary.training.strengthVolume), `${formatNumber(summary.training.durationMinutes)} min`)}
      </div>
      <section class="section-block">
        <div class="section-heading">
          <h2>Macros 宏量营养</h2>
          <span>${escapeHtml(goalBand.label || "goal band")}</span>
        </div>
        <div class="progress-card-grid">
          ${macroKeys.map((key) => renderProgressCard(key, summary.nutrition[key], state.settings.macroTargets?.[key])).join("")}
        </div>
      </section>
      <section class="muscle-map-section">
        <div class="section-heading">
          <h2>Muscle map 肌群图</h2>
          <div class="segmented-control compact" role="group" aria-label="Muscle view 肌群视角">
            <button type="button" data-muscle-view="front" aria-pressed="${state.muscleView === "front"}">Front 前</button>
            <button type="button" data-muscle-view="back" aria-pressed="${state.muscleView === "back"}">Back 后</button>
          </div>
        </div>
        <div class="muscle-map-stage">
          <canvas id="muscle-map-canvas" aria-label="Rotatable 3D muscle map 可旋转三维肌群图"></canvas>
          <p class="muscle-fallback">3D view unavailable 三维视图不可用</p>
          <div class="muscle-legend" aria-label="Muscle recency legend 肌群训练时间图例">
            <span><i class="recent"></i>0-1d</span>
            <span><i class="warm"></i>2-3d</span>
            <span><i class="attention"></i>7d+</span>
          </div>
        </div>
      </section>
      ${renderTrainingComparison(comparison)}
      <details class="overview-details section-block">
        <summary>MIC 微量营养 · Daily targets 每日目标</summary>
        <div class="micro-grid">
          ${micronutrientKeys.map((key) => renderMicroProgress(key, summary.nutrition[key], state.settings.micronutrientTargets?.[key])).join("")}
        </div>
      </details>
      <section class="section-block">
        <div class="section-heading">
          <h2>Recent food 最近食物</h2>
          <span>${selectedFood.length} 条</span>
        </div>
        ${renderEditableSnippetList(selectedFood, renderFoodSnippet, "foodEntries")}
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Recent training 最近训练</h2>
          <span>${selectedTraining.length} 条</span>
        </div>
        ${renderEditableSnippetList(selectedTraining, renderTrainingSnippet, "trainingSessions")}
      </section>
      <section class="section-block">
        <div class="section-heading">
          <h2>Week 本周概览</h2>
          <span>${escapeHtml(weekStart)}</span>
        </div>
        ${renderMiniWeeklyChart(weekly)}
      </section>
    </section>
  `;
}

function renderFoodPage() {
  const selectedFood = recordsForDate(state.foodEntries, state.selectedDate);
  const editingEntry = state.foodEntries.find((entry) => entry.id === state.editingFoodId) || null;
  const values = foodEntryFormValues(editingEntry, state.selectedDate);

  return `
    <section class="screen">
      ${renderTopbar("Food 食物")}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <form class="entry-form" data-form="food" ${recordIdAttribute(editingEntry)}>
        ${editingEntry ? '<div class="form-heading"><h2>Edit food 编辑食物</h2></div>' : ""}
        <div class="form-grid">
          ${inputField("DATE 日期", "date", "date", values.date)}
          ${selectField("MEAL 餐次", "meal", mealOptions, values.meal)}
          ${inputField("FOOD 食物", "name", "text", values.name, { required: true, placeholder: "Chicken rice" })}
          ${inputField("GRAMS 克数(g)", "grams", "number", values.grams, { min: "0", step: "1" })}
          ${inputField("CAL 热量(KCAL)", "calories", "number", values.calories, { min: "0", step: "0.1" })}
          ${inputField("PRO 蛋白(g)", "protein", "number", values.protein, { min: "0", step: "0.1" })}
          ${inputField("CARB 碳水(g)", "carbs", "number", values.carbs, { min: "0", step: "0.1" })}
          ${inputField("FAT 脂肪(g)", "fat", "number", values.fat, { min: "0", step: "0.1" })}
          ${inputField("SOURCE 来源", "source", "text", values.source)}
          <details class="form-details wide-field">
            <summary>MIC 补充营养</summary>
            <div class="form-grid detail-grid">
              ${inputField("FIBER 膳食纤维(g)", "fiber", "number", values.fiber, { min: "0", step: "0.1" })}
              ${inputField("SUGAR 糖(g)", "sugar", "number", values.sugar, { min: "0", step: "0.1" })}
              ${inputField("SODIUM 钠(mg)", "sodium", "number", values.sodium, { min: "0", step: "0.1" })}
            </div>
          </details>
          <details class="form-details wide-field">
            <summary>MIN 矿物质</summary>
            <div class="form-grid detail-grid">
              ${inputField("CALCIUM 钙(mg)", "calcium", "number", values.calcium, { min: "0", step: "0.1" })}
              ${inputField("IRON 铁(mg)", "iron", "number", values.iron, { min: "0", step: "0.1" })}
              ${inputField("MAG 镁(mg)", "magnesium", "number", values.magnesium, { min: "0", step: "0.1" })}
              ${inputField("POTASS 钾(mg)", "potassium", "number", values.potassium, { min: "0", step: "0.1" })}
              ${inputField("ZINC 锌(mg)", "zinc", "number", values.zinc, { min: "0", step: "0.1" })}
            </div>
          </details>
          <details class="form-details wide-field">
            <summary>VIT 维生素</summary>
            <div class="form-grid detail-grid">
              ${inputField("VIT A 维A(mcg)", "vitaminA", "number", values.vitaminA, { min: "0", step: "0.1" })}
              ${inputField("VIT C 维C(mg)", "vitaminC", "number", values.vitaminC, { min: "0", step: "0.1" })}
              ${inputField("VIT D 维D(mcg)", "vitaminD", "number", values.vitaminD, { min: "0", step: "0.1" })}
              ${inputField("B12 维B12(mcg)", "vitaminB12", "number", values.vitaminB12, { min: "0", step: "0.1" })}
            </div>
          </details>
        </div>
        ${renderFormActions("foodEntries", editingEntry, "Add food 添加食物", "Save food 保存食物")}
      </form>
      <ul class="record-list">
        ${selectedFood.length ? selectedFood.map(renderFoodListItem).join("") : emptyState("No food entries. 暂无食物记录")}
      </ul>
    </section>
  `;
}

function renderTrainingPage() {
  const selectedTraining = recordsForDate(state.trainingSessions, state.selectedDate);
  const editingSession = state.trainingSessions.find((session) => session.id === state.editingTrainingId) || null;
  const editingStrength = isStrengthSession(editingSession) ? editingSession : null;
  const editingActivity = editingSession && !isStrengthSession(editingSession) ? editingSession : null;
  const mode = editingSession ? (editingStrength ? "strength" : "activity") : state.trainingMode;
  const strengthValues = strengthSessionFormValues(editingStrength, state.selectedDate);
  const activityValues = activitySessionFormValues(editingActivity, state.selectedDate);

  return `
    <section class="screen">
      ${renderTopbar("Training 训练")}
      ${renderErrorBanner()}
      ${renderDateTools()}
      <div class="segmented-control training-mode" role="group" aria-label="Training mode 训练模式">
        <button type="button" data-training-mode="strength" aria-pressed="${mode === "strength"}">Strength 力量</button>
        <button type="button" data-training-mode="activity" aria-pressed="${mode === "activity"}">Outdoor 户外</button>
      </div>
      ${mode === "strength"
        ? renderStrengthForm(strengthValues, editingStrength)
        : renderActivityForm(activityValues, editingActivity)}
      <ul class="record-list">
        ${selectedTraining.length ? selectedTraining.map(renderTrainingListItem).join("") : emptyState("No training sessions. 暂无训练记录")}
      </ul>
    </section>
  `;
}

function renderStrengthForm(values, editingRecord) {
  return `
    <form class="entry-form" data-form="strength" ${recordIdAttribute(editingRecord)}>
      <div class="form-heading"><h2>${editingRecord ? "Edit strength 编辑力量" : "Strength 力量"}</h2></div>
      <div class="form-grid">
        ${inputField("DATE 日期", "date", "date", values.date)}
        ${inputField("DUR 时长(MIN)", "durationMinutes", "number", values.durationMinutes, { min: "0", step: "1" })}
        <div class="exercise-stack wide-field">
          ${Array.from({ length: 3 }, (_, index) => renderStrengthExerciseFields(values, index + 1)).join("")}
        </div>
        ${textareaField("Notes 备注", "notes", values.notes)}
      </div>
      ${renderFormActions("trainingSessions", editingRecord, "Add strength 添加力量", "Save strength 保存力量")}
    </form>
  `;
}

function renderStrengthExerciseFields(values, exerciseNumber) {
  const handMode = values[`handMode${exerciseNumber}`] || "single 单重";
  return `
    <section class="exercise-entry" data-hand-mode="${resolveHandMode(handMode)}">
      <div class="exercise-entry-heading">
        <h3>动作 ${exerciseNumber}<small>EX ${exerciseNumber}</small></h3>
        ${selectField("WEIGHT 重量方式", `handMode${exerciseNumber}`, handModeOptions, handMode, {
          dataHandModeSelect: "true"
        })}
      </div>
      <div class="exercise-meta-grid">
        ${datalistField("EXER 动作（可输入）", `exerciseName${exerciseNumber}`, strengthExerciseOptions, values[`exerciseName${exerciseNumber}`], exerciseNumber === 1)}
        ${selectField("MUS 肌群", `muscleGroup${exerciseNumber}`, muscleGroupOptions, values[`muscleGroup${exerciseNumber}`])}
      </div>
      <div class="set-grid">
        <div class="set-table-header" aria-hidden="true"><span>#</span><span>重量 kg</span><span>次数</span></div>
        ${Array.from({ length: 6 }, (_, index) => {
          const setNumber = index + 1;
          const prefix = `e${exerciseNumber}`;
          return `
            <div class="set-row">
              <span>${setNumber}</span>
              <div class="single-weight-field">
                ${compactNumberField(`动作 ${exerciseNumber} 第 ${setNumber} 组重量`, `${prefix}weight${setNumber}`, values[`${prefix}weight${setNumber}`], "kg", "0.5")}
              </div>
              <div class="split-weight-fields">
                ${compactNumberField(`动作 ${exerciseNumber} 第 ${setNumber} 组左手重量`, `${prefix}leftWeight${setNumber}`, values[`${prefix}leftWeight${setNumber}`], "L", "0.5")}
                ${compactNumberField(`动作 ${exerciseNumber} 第 ${setNumber} 组右手重量`, `${prefix}rightWeight${setNumber}`, values[`${prefix}rightWeight${setNumber}`], "R", "0.5")}
              </div>
              ${compactNumberField(`动作 ${exerciseNumber} 第 ${setNumber} 组次数`, `${prefix}reps${setNumber}`, values[`${prefix}reps${setNumber}`], "reps", "1")}
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderActivityForm(values, editingRecord) {
  return `
    <form class="entry-form" data-form="activity" ${recordIdAttribute(editingRecord)}>
      <div class="form-heading"><h2>${editingRecord ? "Edit outdoor 编辑户外" : "Outdoor 户外"}</h2></div>
      <div class="form-grid">
        ${inputField("DATE 日期", "date", "date", values.date)}
        ${selectField("TYPE 类型", "activityType", activities, values.activityType)}
        ${inputField("DUR 时长(MIN)", "durationMinutes", "number", values.durationMinutes, { min: "0", step: "1" })}
        ${inputField("DIST 距离(KM)", "distanceKm", "number", values.distanceKm, { min: "0", step: "0.01" })}
        ${selectField("INT 强度", "intensity", intensities, values.intensity)}
        ${textareaField("Notes 备注", "notes", values.notes)}
      </div>
      ${renderFormActions("trainingSessions", editingRecord, "Add activity 添加户外", "Save activity 保存户外")}
    </form>
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
      ${renderTopbar("Reports 报告", `${renderSettingsButton()}<button class="ghost-button" type="button" data-action="download-xlsx">Excel</button>`)}
      ${renderErrorBanner()}
      ${renderStatusBanner()}
      ${renderDateTools()}
      <div class="reports-grid">
        ${renderTrainingCategoryChart(state.trainingSessions, weekStart)}
        ${renderDualBarChart("Calories 热量摄入与训练", report.series.dates, report.series.calorieIntake, report.series.trainingCalories, "Intake", "Training", "kcal")}
        ${renderBarChart("Net calories 净热量", report.series.dates, report.series.netCalories, "kcal", "bar-net")}
        ${renderBarChart("Protein 蛋白质", report.series.dates, report.series.protein, "g", "bar-protein")}
        ${renderBarChart("Strength volume 力量容量", report.series.dates, report.series.strengthVolume, "kg x reps", "bar-strength")}
        ${renderAerobicChart(
          report.series.dates,
          report.series.aerobicDistance,
          report.series.aerobicDuration || report.days.map((day) => day.training.aerobicDurationMinutes ?? day.training.durationMinutes ?? 0)
        )}
      </div>
      <details class="report-details">
        <summary>MAC 宏量营养周报</summary>
        ${renderMacronutrientSummary(report, state.settings)}
      </details>
      <details class="report-details">
        <summary>MIC 矿物质与纤维周报</summary>
        ${renderMicronutrientSummary(report, state.settings, mineralKeys, "Minerals & fiber 矿物质与纤维")}
      </details>
      <details class="report-details">
        <summary>VIT 维生素周报</summary>
        ${renderMicronutrientSummary(report, state.settings, vitaminKeys, "Vitamins 维生素")}
      </details>
      ${renderReportDataManagement()}
    </section>
  `;
}

function renderReportDataManagement() {
  const range = state.pendingCleanupRange;
  const previewStart = range?.start || state.selectedDate;
  const previewEnd = range?.end || state.selectedDate;
  const food = recordsInDateRange(state.foodEntries, previewStart, previewEnd);
  const training = recordsInDateRange(state.trainingSessions, previewStart, previewEnd);
  const total = food.length + training.length;
  const confirming = Boolean(range);

  return `
    <section class="data-management section-block">
      <div class="section-heading">
        <h2>Data 数据管理</h2>
        <span>Local only 仅本机</span>
      </div>
      <form class="cleanup-summary" data-cleanup-form>
        <div class="cleanup-range-fields">
          ${inputField("START 开始日期", "cleanupStart", "date", previewStart, { "data-cleanup-start": "true" })}
          ${inputField("END 结束日期", "cleanupEnd", "date", previewEnd, { "data-cleanup-end": "true" })}
        </div>
        <div>
          <strong>${escapeHtml(previewStart)} - ${escapeHtml(previewEnd)}</strong>
          <span>${food.length} food 食物 · ${training.length} training 训练</span>
        </div>
        ${confirming
          ? `
            <div class="cleanup-confirmation" role="alert">
              <p>Delete ${total} records in this date range? 删除后无法撤销。</p>
              <div class="form-actions">
                <button class="delete-button" type="button" data-action="confirm-range-delete">Delete 删除</button>
                <button class="ghost-button" type="button" data-action="cancel-date-delete">Cancel 取消</button>
              </div>
            </div>
          `
          : `<button class="delete-button" type="button" data-action="request-range-delete">Preview deletion 预览删除</button>`}
      </form>
      <div class="management-preview">
        <div>
          <h3>Food 食物</h3>
          ${renderSnippetList(food, renderFoodSnippet)}
        </div>
        <div>
          <h3>Training 训练</h3>
          ${renderSnippetList(training, renderTrainingSnippet)}
        </div>
      </div>
      <details class="backup-details">
        <summary>Advanced backup 高级备份（可选）</summary>
        <p>JSON saves all local records for recovery or moving to another device. JSON 可用于浏览器数据被清除、重装或换设备时恢复全部记录。</p>
        <div class="backup-actions">
          <button class="ghost-button" type="button" data-action="download-json">Export JSON 导出</button>
          <label class="ghost-button file-button">Import JSON 导入<input type="file" accept="application/json,.json" data-backup-input /></label>
        </div>
      </details>
    </section>
  `;
}

function renderSettingsPage() {
  const settings = state.settings || defaultSettings;
  const macros = settings.macroTargets || {};
  const micros = settings.micronutrientTargets || {};

  return `
    <section class="screen">
      ${renderTopbar("Settings 设置", '<button class="icon-button" type="button" data-tab="overview" aria-label="Close settings" title="Close settings">&times;</button>')}
      ${renderErrorBanner()}
      <form class="entry-form settings-form" data-form="settings">
        <section class="settings-section">
          <div class="form-heading"><h2>Personal 基础</h2></div>
          <div class="form-grid">
            ${inputField("BODY 体重(KG)", "bodyWeightKg", "number", formNumberValue(settings.bodyWeightKg, 70), { required: true, min: "1", step: "0.1" })}
            ${inputField("CAL GOAL 热量目标(KCAL)", "calorieGoal", "number", formNumberValue(settings.calorieGoal, 2400), { required: true, min: "0", step: "1" })}
            ${selectField("EXER 目标动作", "preferredExercise", strengthExerciseOptions, settings.preferredExercise || "squat 深蹲")}
            ${selectField("MUS 目标肌群", "preferredMuscleGroup", muscleGroupOptions, settings.preferredMuscleGroup || "quads 股四头")}
            ${inputField("WGT GOAL 目标重量(KG)", "weightGoalKg", "number", formNumberValue(settings.weightGoalKg), { min: "0", step: "0.5" })}
            ${textareaField("BEST 最佳动作提醒", "bestExerciseNote", settings.bestExerciseNote || "")}
            ${textareaField("MEMO 个人备注", "personalMemo", settings.personalMemo || "")}
          </div>
        </section>
        <section class="settings-section">
          <div class="form-heading"><h2>Macros 宏量目标</h2></div>
          <div class="form-grid">
            ${inputField("PRO 蛋白(g)", "protein", "number", formNumberValue(macros.protein), { required: true, min: "0", step: "0.1" })}
            ${inputField("CARB 碳水(g)", "carbs", "number", formNumberValue(macros.carbs), { required: true, min: "0", step: "0.1" })}
            ${inputField("FAT 脂肪(g)", "fat", "number", formNumberValue(macros.fat), { required: true, min: "0", step: "0.1" })}
          </div>
        </section>
        <details class="form-details settings-section">
          <summary>MIC 微量营养目标</summary>
          <div class="form-grid detail-grid">
            ${inputField("CALCIUM 钙(mg)", "calcium", "number", formNumberValue(micros.calcium), { min: "0", step: "0.1" })}
            ${inputField("IRON 铁(mg)", "iron", "number", formNumberValue(micros.iron), { min: "0", step: "0.1" })}
            ${inputField("MAG 镁(mg)", "magnesium", "number", formNumberValue(micros.magnesium), { min: "0", step: "0.1" })}
            ${inputField("POTASS 钾(mg)", "potassium", "number", formNumberValue(micros.potassium), { min: "0", step: "0.1" })}
            ${inputField("ZINC 锌(mg)", "zinc", "number", formNumberValue(micros.zinc), { min: "0", step: "0.1" })}
            ${inputField("SODIUM 钠(mg)", "sodium", "number", formNumberValue(micros.sodium), { min: "0", step: "0.1" })}
            ${inputField("FIBER 膳食纤维(g)", "fiber", "number", formNumberValue(micros.fiber), { min: "0", step: "0.1" })}
          </div>
        </details>
        <details class="form-details settings-section">
          <summary>VIT 维生素目标</summary>
          <div class="form-grid detail-grid">
            ${inputField("VIT A 维A(mcg)", "vitaminA", "number", formNumberValue(micros.vitaminA), { min: "0", step: "0.1" })}
            ${inputField("VIT C 维C(mg)", "vitaminC", "number", formNumberValue(micros.vitaminC), { min: "0", step: "0.1" })}
            ${inputField("VIT D 维D(mcg)", "vitaminD", "number", formNumberValue(micros.vitaminD), { min: "0", step: "0.1" })}
            ${inputField("B12 维B12(mcg)", "vitaminB12", "number", formNumberValue(micros.vitaminB12), { min: "0", step: "0.1" })}
          </div>
        </details>
        <button class="primary-button" type="submit">Save settings 保存设置</button>
      </form>
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
  const className = title.startsWith("Reports") ? "topbar reports-topbar" : "topbar";
  return `
    <header class="${className}">
      <h1>${escapeHtml(title)}${renderOracleGlyph(title)}</h1>
      <div class="topbar-actions">${action}</div>
    </header>
  `;
}

function renderOracleGlyph(title) {
  const key = title.startsWith("Overview")
    ? "overview"
    : title.startsWith("Food")
      ? "food"
      : title.startsWith("Training")
        ? "training"
        : title.startsWith("Reports")
          ? "reports"
          : "";
  const paths = {
    overview: '<path d="M4 12c4-7 12-7 16 0-4 7-12 7-16 0Z"/><circle cx="12" cy="12" r="2.5"/>',
    food: '<path d="M6 9c3-4 9-4 12 0M8 10l1 9h6l1-9M7 14h10M10 5c1-2 3-2 4 0"/>',
    training: '<path d="M9 10 7 3M15 10l2-7M10 9 3 7M14 15l3 6M10 15 7-3M7 17l3-2M9 10 3 3 3-3"/>',
    reports: '<path d="M6 4v16M10 3v18M14 3v18M18 4v16M5 8h14M5 16h14"/>'
  };
  if (!paths[key]) return "";
  return `<svg class="oracle-glyph oracle-${key}" viewBox="0 0 24 24" aria-hidden="true">${paths[key]}</svg>`;
}

function renderSettingsButton() {
  return '<button class="icon-button" type="button" data-tab="settings" aria-label="Settings 设置" title="Settings 设置">&#9881;</button>';
}

function renderErrorBanner() {
  if (!state.errorMessage) return "";
  return `<div class="error-banner" role="alert">${escapeHtml(state.errorMessage)}</div>`;
}

function renderStatusBanner() {
  if (!state.statusMessage) return "";
  return `<div class="status-banner" role="status">${escapeHtml(state.statusMessage)}</div>`;
}

function renderDateTools() {
  return `
    <div class="date-tools">
      <button type="button" class="icon-button" data-date-shift="-1" aria-label="Previous day 前一天">&lt;</button>
      <label>
        <span>DATE 日期</span>
        <input type="date" value="${escapeHtml(state.selectedDate)}" data-date-input />
      </label>
      <button type="button" class="icon-button" data-date-shift="1" aria-label="Next day 后一天">&gt;</button>
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

function renderGoalCard(comparison) {
  const exercise = comparison.exerciseName || state.settings.preferredExercise || "Not set 未设置";
  const muscle = comparison.muscleGroup || state.settings.preferredMuscleGroup || "Not set 未设置";
  const weightGoal = Number(state.settings.weightGoalKg) || 0;
  return `
    <section class="goal-card">
      <div class="goal-primary">
        <span>GOAL 今日目标</span>
        <strong>${escapeHtml(exercise)}</strong>
        <small>${escapeHtml(muscle)} · ${weightGoal ? `${formatNumber(weightGoal)} kg` : "Weight 待设置"}</small>
      </div>
      <div class="goal-notes">
        <p><b>BEST 最佳动作</b>${escapeHtml(state.settings.bestExerciseNote || "-")}</p>
        <p><b>MEMO 个人备注</b>${escapeHtml(state.settings.personalMemo || "-")}</p>
      </div>
    </section>
  `;
}

function renderTrainingComparison(comparison) {
  const maxWeight = Math.max(1, ...comparison.points.map((point) => point.maxWeight));
  return `
    <section class="section-block comparison-section">
      <div class="section-heading">
        <h2>Progress 训练对比</h2>
        <span>${escapeHtml(comparison.exerciseName || "No exercise 无动作")}</span>
      </div>
      ${comparison.points.length
        ? `<div class="comparison-chart" role="img" aria-label="Training weight comparison 训练重量对比">
            ${comparison.points
              .map(
                (point) => `
                  <div class="comparison-point">
                    <strong>${formatNumber(point.maxWeight)}<small>kg</small></strong>
                    <span style="--comparison-height: ${Math.max(8, Math.round((point.maxWeight / maxWeight) * 100))}%"></span>
                    <small>${escapeHtml(point.date.slice(5))}</small>
                  </div>
                `
              )
              .join("")}
          </div>`
        : '<p class="inline-empty">Log strength training to build a comparison. 记录力量训练后显示对比。</p>'}
    </section>
  `;
}

function renderSnippetList(records, renderer) {
  if (records.length === 0) return `<ul class="snippet-list">${emptyState("Nothing logged yet.")}</ul>`;
  return `<ul class="snippet-list">${records.slice(0, 3).map((record) => `<li>${renderer(record)}</li>`).join("")}</ul>`;
}

function renderEditableSnippetList(records, renderer, storeName) {
  if (records.length === 0) return `<ul class="snippet-list">${emptyState("Nothing logged yet. 暂无记录")}</ul>`;
  return `
    <ul class="snippet-list editable-snippets">
      ${records
        .slice(0, 3)
        .map(
          (record) => `
            <li>
              <button type="button" data-edit-store="${escapeHtml(storeName)}" data-id="${escapeHtml(record.id)}">
                ${renderer(record)}
              </button>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
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
    <span>${escapeHtml(trainingCategoryLabel(session))}</span>
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
      ${renderRecordActions("foodEntries", entry.id)}
    </li>
  `;
}

function renderTrainingListItem(session) {
  return `
    <li>
      <div class="record-main">
        <span>${escapeHtml(trainingCategoryLabel(session))}</span>
        <strong>${escapeHtml(trainingTitle(session))}</strong>
        <small>${escapeHtml(trainingSessionMeta(session))}</small>
      </div>
      ${renderRecordActions("trainingSessions", session.id)}
    </li>
  `;
}

function renderRecordActions(storeName, id) {
  return `
    <div class="record-actions">
      <button class="ghost-button" type="button" data-edit-store="${escapeHtml(storeName)}" data-id="${escapeHtml(id)}">Edit 编辑</button>
      <button class="delete-button" type="button" data-delete-store="${escapeHtml(storeName)}" data-id="${escapeHtml(id)}">Delete 删除</button>
    </div>
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

export function renderMicronutrientSummary(
  report,
  settings = {},
  keys = micronutrientKeys,
  title = "Micronutrient completion"
) {
  const dayCount = Math.max(1, report.days?.length || 0);

  return `
    <section class="chart-card summary-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="summary-list micro-summary">
        ${keys
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

export function countTrainingCategories(trainingSessions, weekStart) {
  const weekEnd = addDays(weekStart, 6);
  const aerobicTypes = new Set(["running", "cycling", "walking", "hiking", "hiit", "swimming", "rowing"]);
  return trainingSessions
    .filter((session) => session.date >= weekStart && session.date <= weekEnd)
    .reduce(
      (counts, session) => {
        if (isStrengthSession(session)) counts.strength += 1;
        else if (aerobicTypes.has(session.activityType)) counts.aerobic += 1;
        else counts.other += 1;
        return counts;
      },
      { strength: 0, aerobic: 0, other: 0 }
    );
}

export function renderTrainingCategoryChart(trainingSessions, weekStart) {
  const counts = countTrainingCategories(trainingSessions, weekStart);
  const items = [
    ["Strength 力量", counts.strength, "bar-strength"],
    ["Aerobic 有氧", counts.aerobic, "bar-distance"],
    ["Other 其他", counts.other, "bar-other"]
  ];
  const max = Math.max(1, ...items.map((item) => item[1]));
  const width = 420;
  const baseline = 126;
  const plotHeight = 104;
  const groupWidth = width / items.length;
  const barWidth = 46;
  return `
    <section class="chart-card category-chart">
      <h2>Training mix 训练项目统计</h2>
      <svg class="report-svg" role="img" aria-label="Strength ${counts.strength}, aerobic ${counts.aerobic}, other ${counts.other}" viewBox="0 0 ${width} 188" preserveAspectRatio="none">
        <line class="svg-axis" x1="0" y1="${baseline}" x2="${width}" y2="${baseline}"></line>
        ${items.map(([label, value, className], index) => {
          const center = Math.round(index * groupWidth + groupWidth / 2);
          const barHeight = value ? Math.max(4, Math.round((value / max) * plotHeight)) : 0;
          return `
            <rect class="${className}" x="${center - barWidth / 2}" y="${baseline - barHeight}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
            <text class="svg-value" x="${center}" y="${Math.max(14, baseline - barHeight - 7)}" text-anchor="middle">${value}</text>
            <text class="svg-label" x="${center}" y="151" text-anchor="middle">${escapeHtml(label)}</text>
          `;
        }).join("")}
      </svg>
    </section>
  `;
}

export function renderAerobicChart(labels = [], distances = [], durations = []) {
  const maxDistance = Math.max(1, ...distances.map(Number));
  const maxDuration = Math.max(1, ...durations.map(Number));
  const width = 420;
  const baseline = 126;
  const plotHeight = 108;
  const groupWidth = width / Math.max(1, labels.length);
  return `
    <section class="chart-card">
      <h2>Aerobic distance & duration 有氧距离与时长</h2>
      <div class="chart-legend"><span><i class="distance"></i>Distance km</span><span><i class="duration"></i>Duration min</span></div>
      <svg class="report-svg" role="img" aria-label="Aerobic distance and duration" viewBox="0 0 ${width} 188" preserveAspectRatio="none">
        <line class="svg-axis" x1="0" y1="${baseline}" x2="${width}" y2="${baseline}"></line>
        ${labels.map((label, index) => {
          const distance = Number(distances[index]) || 0;
          const duration = Number(durations[index]) || 0;
          const center = Math.round(index * groupWidth + groupWidth / 2);
          const distanceHeight = distance ? Math.max(3, Math.round((distance / maxDistance) * plotHeight)) : 0;
          const durationHeight = duration ? Math.max(3, Math.round((duration / maxDuration) * plotHeight)) : 0;
          return `
            <rect class="bar-distance" x="${center - 15}" y="${baseline - distanceHeight}" width="12" height="${distanceHeight}" rx="4"></rect>
            <rect class="bar-duration" x="${center + 3}" y="${baseline - durationHeight}" width="12" height="${durationHeight}" rx="4"></rect>
            <text class="svg-label" x="${center}" y="148" text-anchor="middle">${escapeHtml(label.slice(5))}</text>
            <title>${escapeHtml(label)}: ${formatNumber(distance)} km, ${formatNumber(duration)} min</title>
          `;
        }).join("")}
      </svg>
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

function selectField(label, name, options, selected, attributes = {}) {
  const availableOptions = options.includes(selected) || !selected ? options : [selected, ...options];
  const attrs = Object.entries(attributes)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escapeHtml(value)}"`)
    .join(" ");
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" ${attrs}>
        ${availableOptions.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function datalistField(label, name, options, value, required = false) {
  const listId = `${name}-options`;
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" type="text" value="${escapeHtml(value)}" list="${escapeHtml(listId)}" ${required ? "required" : ""} />
      <datalist id="${escapeHtml(listId)}">
        ${options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}
      </datalist>
    </label>
  `;
}

function compactNumberField(label, name, value, placeholder, step) {
  return `<input class="compact-set-input" name="${escapeHtml(name)}" type="number" value="${escapeHtml(value)}" min="0" step="${escapeHtml(step)}" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(label)}" />`;
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

function renderFormActions(storeName, editingRecord, addLabel, saveLabel) {
  if (!editingRecord) {
    return `<button class="primary-button" type="submit">${escapeHtml(addLabel)}</button>`;
  }
  return `
    <div class="form-actions">
      <button class="primary-button" type="submit">${escapeHtml(saveLabel)}</button>
      <button class="ghost-button" type="button" data-cancel-edit="${escapeHtml(storeName)}">Cancel 取消</button>
    </div>
  `;
}

function recordIdAttribute(record) {
  return record ? `data-record-id="${escapeHtml(record.id)}"` : "";
}

function foodEntryFormValues(entry, fallbackDate) {
  const nutrients = entry?.nutrientsPer100g || {};
  return {
    date: entry?.date || fallbackDate,
    meal: entry?.meal || "lunch",
    name: entry?.name || "",
    grams: formNumberValue(entry?.grams),
    calories: formNumberValue(nutrients.calories),
    protein: formNumberValue(nutrients.protein),
    carbs: formNumberValue(nutrients.carbs),
    fat: formNumberValue(nutrients.fat),
    fiber: formNumberValue(nutrients.fiber),
    sugar: formNumberValue(nutrients.sugar),
    sodium: formNumberValue(nutrients.sodium),
    calcium: formNumberValue(nutrients.calcium),
    iron: formNumberValue(nutrients.iron),
    magnesium: formNumberValue(nutrients.magnesium),
    potassium: formNumberValue(nutrients.potassium),
    zinc: formNumberValue(nutrients.zinc),
    vitaminA: formNumberValue(nutrients.vitaminA),
    vitaminC: formNumberValue(nutrients.vitaminC),
    vitaminD: formNumberValue(nutrients.vitaminD),
    vitaminB12: formNumberValue(nutrients.vitaminB12),
    source: entry?.source || "manual"
  };
}

function strengthSessionFormValues(session, fallbackDate) {
  const values = {
    date: session?.date || fallbackDate,
    durationMinutes: formNumberValue(session?.durationMinutes, "45"),
    notes: session?.notes || ""
  };
  for (let exerciseIndex = 0; exerciseIndex < 3; exerciseIndex += 1) {
    const exerciseNumber = exerciseIndex + 1;
    const exercise = session?.exercises?.[exerciseIndex] || {};
    const storedHandMode = exercise.handMode || (exerciseIndex === 0 ? session?.handMode : "single");
    const split = storedHandMode === "split" || exercise.sets?.some((set) => set.leftWeight !== undefined || set.rightWeight !== undefined);
    values[`exerciseName${exerciseNumber}`] = exercise.name || (exerciseNumber === 1 ? "squat 深蹲" : "");
    values[`muscleGroup${exerciseNumber}`] = exercise.muscleGroup || (exerciseNumber === 1 ? "quads 股四头" : "");
    values[`handMode${exerciseNumber}`] = split ? "split 左右" : "single 单重";
    for (let setIndex = 0; setIndex < 6; setIndex += 1) {
      const setNumber = setIndex + 1;
      const set = exercise.sets?.[setIndex];
      const prefix = `e${exerciseNumber}`;
      values[`${prefix}weight${setNumber}`] = formNumberValue(set?.weight);
      values[`${prefix}leftWeight${setNumber}`] = formNumberValue(set?.leftWeight);
      values[`${prefix}rightWeight${setNumber}`] = formNumberValue(set?.rightWeight);
      values[`${prefix}reps${setNumber}`] = formNumberValue(set?.reps);
    }
  }
  return values;
}

function activitySessionFormValues(session, fallbackDate) {
  return {
    date: session?.date || fallbackDate,
    activityType: session?.activityType || "running",
    durationMinutes: formNumberValue(session?.durationMinutes, "30"),
    distanceKm: formNumberValue(session?.distanceKm),
    intensity: session?.intensity || "moderate",
    notes: session?.notes || ""
  };
}

function formNumberValue(value, fallback = "") {
  return value === undefined || value === null ? fallback : value;
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;

  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    const formType = form.dataset.form;
    const recordId = form.dataset.recordId || null;

    if (formType === "food") {
      const existing = state.foodEntries.find((entry) => entry.id === recordId);
      const saved = await storageAdapters.saveRecord("foodEntries", {
        ...existing,
        ...buildFoodEntryRecord(values),
        ...(recordId ? { id: recordId } : {})
      });
      state.foodEntries = upsertRecord(state.foodEntries, saved);
      state.editingFoodId = null;
      state.selectedDate = saved.date;
    }

    if (formType === "strength") {
      const existing = state.trainingSessions.find((session) => session.id === recordId);
      const strengthRecord = buildStrengthSessionRecord({
        ...values,
        bodyWeightKg: state.settings?.bodyWeightKg
      });
      const usesIndexedExercises = Object.prototype.hasOwnProperty.call(values, "exerciseName1");
      strengthRecord.exercises.forEach((exercise, index) => {
        const additionalSets = existing?.exercises?.[index]?.sets?.slice(6) || [];
        if (additionalSets.length > 0) exercise.sets.push(...additionalSets);
      });
      const additionalExercises = existing?.exercises?.slice(usesIndexedExercises ? 3 : 1) || [];
      if (additionalExercises.length > 0) {
        strengthRecord.exercises.push(...additionalExercises);
      }
      const saved = await storageAdapters.saveRecord(
        "trainingSessions",
        {
          ...existing,
          ...strengthRecord,
          ...(recordId ? { id: recordId } : {})
        }
      );
      state.trainingSessions = upsertRecord(state.trainingSessions, saved);
      state.editingTrainingId = null;
      state.selectedDate = saved.date;
    }

    if (formType === "activity") {
      const existing = state.trainingSessions.find((session) => session.id === recordId);
      const saved = await storageAdapters.saveRecord("trainingSessions", {
        ...existing,
        ...buildActivitySessionRecord(values),
        ...(recordId ? { id: recordId } : {})
      });
      state.trainingSessions = upsertRecord(state.trainingSessions, saved);
      state.editingTrainingId = null;
      state.selectedDate = saved.date;
    }

    if (formType === "settings") {
      state.settings = await storageAdapters.saveRecord(
        "settings",
        buildSettingsRecord(values, state.settings)
      );
      state.activeTab = "overview";
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

  const muscleViewButton = event.target.closest("[data-muscle-view]");
  if (muscleViewButton) {
    state.muscleView = muscleViewButton.dataset.muscleView === "back" ? "back" : "front";
    renderApp();
    return;
  }

  const trainingModeButton = event.target.closest("[data-training-mode]");
  if (trainingModeButton) {
    state.trainingMode = trainingModeButton.dataset.trainingMode === "activity" ? "activity" : "strength";
    state.editingTrainingId = null;
    renderApp();
    return;
  }

  const dateShift = event.target.closest("[data-date-shift]");
  if (dateShift) {
    state.selectedDate = addDays(state.selectedDate, Number(dateShift.dataset.dateShift) || 0);
    clearEditingState();
    state.pendingCleanupRange = null;
    renderApp();
    return;
  }

  const requestRangeDelete = event.target.closest('[data-action="request-range-delete"]');
  if (requestRangeDelete) {
    const form = requestRangeDelete.closest("[data-cleanup-form]");
    const start = form?.querySelector("[data-cleanup-start]")?.value || state.selectedDate;
    const end = form?.querySelector("[data-cleanup-end]")?.value || start;
    state.pendingCleanupRange = { start: start <= end ? start : end, end: start <= end ? end : start };
    state.statusMessage = null;
    renderApp();
    return;
  }

  const cancelDateDelete = event.target.closest('[data-action="cancel-date-delete"]');
  if (cancelDateDelete) {
    state.pendingCleanupRange = null;
    renderApp();
    return;
  }

  const confirmRangeDelete = event.target.closest('[data-action="confirm-range-delete"]');
  if (confirmRangeDelete && state.pendingCleanupRange) {
    const { start, end } = state.pendingCleanupRange;
    const food = recordsInDateRange(state.foodEntries, start, end);
    const training = recordsInDateRange(state.trainingSessions, start, end);
    try {
      await Promise.all([
        ...food.map((entry) => storageAdapters.softDeleteRecord("foodEntries", entry.id)),
        ...training.map((session) => storageAdapters.softDeleteRecord("trainingSessions", session.id))
      ]);
      const deletedFoodIds = new Set(food.map((entry) => entry.id));
      const deletedTrainingIds = new Set(training.map((session) => session.id));
      state.foodEntries = state.foodEntries.filter((entry) => !deletedFoodIds.has(entry.id));
      state.trainingSessions = state.trainingSessions.filter((session) => !deletedTrainingIds.has(session.id));
      state.pendingCleanupRange = null;
      state.errorMessage = null;
      state.statusMessage = `Deleted ${food.length + training.length} records from ${start} to ${end}.`;
      renderApp();
    } catch (error) {
      console.warn("Date cleanup failed.", error);
      state.errorMessage = "Could not delete the selected date. Please try again.";
      renderApp();
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-store][data-id]");
  if (deleteButton) {
    const storeName = deleteButton.dataset.deleteStore;
    const id = deleteButton.dataset.id;
    const records = storeName === "foodEntries" ? state.foodEntries : state.trainingSessions;
    const record = records.find((item) => item.id === id);
    if (!record) return;
    const confirmed = typeof window === "undefined" || window.confirm(`Delete this record? 删除“${trainingTitle(record)}”后无法撤销。`);
    if (!confirmed) return;
    try {
      await storageAdapters.softDeleteRecord(storeName, id);
      if (storeName === "foodEntries") state.foodEntries = state.foodEntries.filter((item) => item.id !== id);
      else state.trainingSessions = state.trainingSessions.filter((item) => item.id !== id);
      clearEditingState();
      state.statusMessage = "Record deleted. 记录已删除。";
      state.errorMessage = null;
      renderApp();
    } catch (error) {
      console.warn("Record deletion failed.", error);
      state.errorMessage = "Could not delete the record. Please try again.";
      renderApp();
    }
    return;
  }

  const editButton = event.target.closest("[data-edit-store][data-id]");
  if (editButton) {
    const storeName = editButton.dataset.editStore;
    const id = editButton.dataset.id;
    const records = storeName === "foodEntries" ? state.foodEntries : state.trainingSessions;
    const record = records.find((item) => item.id === id);
    if (!record) return;
    state.selectedDate = record.date || state.selectedDate;
    state.editingFoodId = storeName === "foodEntries" ? id : null;
    state.editingTrainingId = storeName === "trainingSessions" ? id : null;
    state.activeTab = storeName === "foodEntries" ? "food" : "training";
    if (storeName === "trainingSessions") {
      state.trainingMode = isStrengthSession(record) ? "strength" : "activity";
    }
    renderApp();
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-edit]");
  if (cancelButton) {
    if (cancelButton.dataset.cancelEdit === "foodEntries") state.editingFoodId = null;
    if (cancelButton.dataset.cancelEdit === "trainingSessions") state.editingTrainingId = null;
    renderApp();
    return;
  }

  const downloadButton = event.target.closest('[data-action="download-xlsx"]');
  if (downloadButton) {
    downloadExcelReport();
    return;
  }

  const backupButton = event.target.closest('[data-action="download-json"]');
  if (backupButton) {
    downloadJsonBackup();
  }
}

async function handleChange(event) {
  if (event.target.matches("[data-date-input]")) {
    state.selectedDate = event.target.value || state.selectedDate;
    clearEditingState();
    state.pendingCleanupRange = null;
    renderApp();
    return;
  }

  if (event.target.matches("[data-hand-mode-select]")) {
    const exerciseEntry = event.target.closest("[data-hand-mode]");
    if (exerciseEntry) exerciseEntry.dataset.handMode = resolveHandMode(event.target.value);
    return;
  }

  if (event.target.matches("[data-backup-input]")) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackupText(await file.text());
      const [foodEntries, trainingSessions, settings] = await Promise.all([
        Promise.all(backup.foodEntries.map((entry) => storageAdapters.saveRecord("foodEntries", entry))),
        Promise.all(backup.trainingSessions.map((session) => storageAdapters.saveRecord("trainingSessions", session))),
        backup.settings ? storageAdapters.saveRecord("settings", backup.settings) : Promise.resolve(null)
      ]);
      state.foodEntries = mergeRecords(state.foodEntries, foodEntries);
      state.trainingSessions = mergeRecords(state.trainingSessions, trainingSessions);
      if (settings) state.settings = settings;
      state.errorMessage = null;
      state.statusMessage = `Imported ${foodEntries.length + trainingSessions.length} records.`;
      renderApp();
    } catch (error) {
      console.warn("Backup import failed.", error);
      state.errorMessage = error.message || "Could not import the backup.";
      renderApp();
    } finally {
      event.target.value = "";
    }
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

export function buildSettingsRecord(values, existing = {}) {
  const macros = existing.macroTargets || {};
  const micros = existing.micronutrientTargets || {};
  return {
    ...existing,
    id: "default",
    bodyWeightKg: settingsNumber(values.bodyWeightKg, existing.bodyWeightKg || 70, 1),
    calorieGoal: settingsNumber(values.calorieGoal, existing.calorieGoal || 0),
    preferredExercise: String(values.preferredExercise || existing.preferredExercise || "").trim(),
    preferredMuscleGroup: String(values.preferredMuscleGroup || existing.preferredMuscleGroup || "").trim(),
    weightGoalKg: settingsNumber(values.weightGoalKg, existing.weightGoalKg || 0),
    bestExerciseNote: String(values.bestExerciseNote ?? existing.bestExerciseNote ?? "").trim(),
    personalMemo: String(values.personalMemo ?? existing.personalMemo ?? "").trim(),
    macroTargets: {
      ...macros,
      protein: settingsNumber(values.protein, macros.protein || 0),
      carbs: settingsNumber(values.carbs, macros.carbs || 0),
      fat: settingsNumber(values.fat, macros.fat || 0)
    },
    micronutrientTargets: {
      ...micros,
      calcium: settingsNumber(values.calcium, micros.calcium || 0),
      iron: settingsNumber(values.iron, micros.iron || 0),
      magnesium: settingsNumber(values.magnesium, micros.magnesium || 0),
      potassium: settingsNumber(values.potassium, micros.potassium || 0),
      zinc: settingsNumber(values.zinc, micros.zinc || 0),
      sodium: settingsNumber(values.sodium, micros.sodium || 0),
      fiber: settingsNumber(values.fiber, micros.fiber || 0),
      vitaminA: settingsNumber(values.vitaminA, micros.vitaminA || 0),
      vitaminC: settingsNumber(values.vitaminC, micros.vitaminC || 0),
      vitaminD: settingsNumber(values.vitaminD, micros.vitaminD || 0),
      vitaminB12: settingsNumber(values.vitaminB12, micros.vitaminB12 || 0)
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
  downloadBlob(blob, `fitness-report-${weekStart}.xlsx`);
}

function downloadJsonBackup() {
  const payload = buildBackupPayload({
    settings: state.settings,
    foodEntries: state.foodEntries,
    trainingSessions: state.trainingSessions
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, `fitness-backup-${getLocalDateString()}.json`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
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

export function recordsInDateRange(records, start, end) {
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  return records
    .filter((record) => record.date >= rangeStart && record.date <= rangeEnd)
    .sort((a, b) => String(b.updatedAt || b.id).localeCompare(String(a.updatedAt || a.id)));
}

function upsertRecord(records, saved) {
  const exists = records.some((record) => record.id === saved.id);
  return exists
    ? records.map((record) => (record.id === saved.id ? saved : record))
    : [...records, saved];
}

function mergeRecords(records, imported) {
  return imported.reduce((merged, record) => upsertRecord(merged, record), records);
}

function clearEditingState() {
  state.editingFoodId = null;
  state.editingTrainingId = null;
}

export function isStrengthSession(session) {
  return Boolean(
    session &&
      (session.category === "strength" ||
        session.activityType === "strength" ||
        session.exercises?.length)
  );
}

function trainingTitle(session) {
  const exercises = (session.exercises || []).map((exercise) => exercise.name).filter(Boolean);
  return exercises.length
    ? exercises.slice(0, 3).join(" · ")
    : session.name || session.activityType || session.category || "Training";
}

function trainingCategoryLabel(session) {
  return isStrengthSession(session)
    ? "Strength 力量"
    : `${session.activityType || session.category || "Outdoor"} 户外`;
}

function trainingSessionMeta(session) {
  const sets = (session.exercises || []).flatMap((exercise) => exercise.sets || []);
  if (sets.length > 0) {
    const volume = sets.reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);
    return `${sets.length} sets - ${formatNumber(volume)} kg x reps - ${formatNumber(session.durationMinutes)} min`;
  }
  return `${formatNumber(session.durationMinutes)} min - ${formatNumber(session.distanceKm)} km`;
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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasFormValue(value) {
  return String(value ?? "").trim() !== "";
}

function settingsNumber(value, fallback, minimum = 0) {
  if (!hasFormValue(value)) return Number(fallback) || minimum;
  return Math.max(minimum, toNumber(value, Number(fallback) || minimum));
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
