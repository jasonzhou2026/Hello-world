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
  if (data.settings !== null && !isRecord(data.settings)) {
    throw new Error("Backup settings are invalid.");
  }

  return {
    settings: data.settings ? { ...data.settings, id: "default" } : null,
    foodEntries: data.foodEntries.filter(isRecord),
    trainingSessions: data.trainingSessions.filter(isRecord)
  };
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
