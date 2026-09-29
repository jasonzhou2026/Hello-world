const BACKUP_FORMAT = "fitness-pwa-backup";
const BACKUP_VERSION = 1;

export function buildBackupPayload({ settings, foodEntries = [], trainingSessions = [] } = {}) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: settings || null,
    foodEntries,
    trainingSessions
  };
}

export function parseBackupText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }

  if (data?.format !== BACKUP_FORMAT || data?.version !== BACKUP_VERSION) {
    throw new Error("Backup format is not supported.");
  }
  if (!Array.isArray(data.foodEntries) || !Array.isArray(data.trainingSessions)) {
    throw new Error("Backup records are incomplete.");
  }
  if (data.settings !== null && !validSettings(data.settings)) {
    throw new Error("Backup settings are invalid.");
  }
  if (!data.foodEntries.every(validFoodRecord)) {
    throw new Error("Backup food records are invalid.");
  }
  if (!data.trainingSessions.every(validTrainingRecord)) {
    throw new Error("Backup training records are invalid.");
  }

  return {
    settings: data.settings ? { ...data.settings, id: "default" } : null,
    foodEntries: data.foodEntries,
    trainingSessions: data.trainingSessions
  };
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalFields(record, keys, validate) {
  return keys.every((key) => !(key in record) || validate(record[key]));
}

const isText = (value) => typeof value === "string";
const isNumber = (value) => (typeof value === "number" || (isText(value) && value.trim() !== "")) && Number.isFinite(Number(value));
const isNonnegative = (value) => isNumber(value) && Number(value) >= 0;
const isNumericMap = (value) => isRecord(value) && Object.values(value).every(isNonnegative);

function validDatedRecord(record) {
  if (!isRecord(record) || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false;
  const date = new Date(`${record.date}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === record.date
    && optionalFields(record, ["id"], (id) => isText(id) && id.trim() !== "")
    && optionalFields(record, ["createdAt", "updatedAt", "deletedAt"], isText);
}

function validFoodRecord(record) {
  return validDatedRecord(record)
    && optionalFields(record, ["name", "meal", "notes", "source"], isText)
    && optionalFields(record, ["grams"], isNonnegative)
    && optionalFields(record, ["nutrientsPer100g"], isNumericMap);
}

function validTrainingRecord(record) {
  return validDatedRecord(record)
    && optionalFields(record, ["name", "category", "activityType", "intensity", "handMode", "notes"], isText)
    && optionalFields(record, ["durationMinutes", "distanceKm", "bodyWeightKg"], isNonnegative)
    && optionalFields(record, ["exercises"], (exercises) => Array.isArray(exercises) && exercises.every((exercise) =>
      isRecord(exercise)
      && optionalFields(exercise, ["name", "muscleGroup", "equipment", "handMode"], isText)
      && optionalFields(exercise, ["sets"], (sets) => Array.isArray(sets) && sets.every((set) =>
        isRecord(set) && optionalFields(set, ["weight", "reps", "leftWeight", "rightWeight"], isNonnegative)
      ))
    ));
}

function validSettings(settings) {
  return isRecord(settings)
    && optionalFields(settings, ["preferredExercise", "preferredMuscleGroup", "bestExerciseNote", "personalMemo"], isText)
    && optionalFields(settings, ["bodyWeightKg", "calorieGoal", "weightGoalKg"], isNonnegative)
    && optionalFields(settings, ["macroTargets", "micronutrientTargets"], isNumericMap)
    && optionalFields(settings, ["samplesSeeded"], (value) => typeof value === "boolean")
    && optionalFields(settings, ["calorieGoalBand"], (band) => isRecord(band)
      && optionalFields(band, ["min", "max"], isNumber)
      && optionalFields(band, ["label"], isText));
}
