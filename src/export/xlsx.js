import { calculateFoodEntryNutrition, NUTRIENT_KEYS } from "../domain/nutrition.js";
import { buildWeeklyReport } from "../domain/reports.js";
import { calculateStrengthVolume, calculateTrainingCalories } from "../domain/training.js";

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_UTF8_FLAG = 0x0800;

export const NUTRIENT_EXCEL_LABELS = Object.freeze({
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbohydrate",
  fat: "Fat",
  fiber: "Fiber",
  sugar: "Sugar",
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
});

export const NUTRIENT_EXCEL_HEADERS = Object.freeze(
  NUTRIENT_KEYS.map((key) => NUTRIENT_EXCEL_LABELS[key] || key)
);

export function buildExportRows({ foodEntries = [], trainingSessions = [], weekStart }) {
  const report = buildWeeklyReport({ weekStart, foodEntries, trainingSessions });

  return {
    "Daily Summary": [
      [
        "Date",
        "Intake Calories",
        "Training Calories",
        "Net Calories",
        "Protein",
        "Carbohydrate",
        "Fat",
        "Fiber",
        "Strength Volume",
        "Training Duration",
        "Aerobic Distance"
      ],
      ...report.days.map((day) => [
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
      ["Date", "Meal", "Food", "Serving Grams", ...NUTRIENT_EXCEL_HEADERS, "Source"],
      ...foodEntries.map((entry) => {
        const nutrition = calculateFoodEntryNutrition(entry);
        return [
          entry.date,
          entry.meal,
          entry.name,
          entry.grams,
          ...NUTRIENT_KEYS.map((key) => nutrition.totals[key]),
          entry.source || "manual"
        ];
      })
    ],
    "Training Details": [
      [
        "Date",
        "Category",
        "Activity Or Exercise",
        "Muscle Group",
        "Sets",
        "Reps",
        "Weight",
        "Duration",
        "Distance",
        "Intensity",
        "Volume",
        "Estimated Calories",
        "Notes"
      ],
      ...trainingSessions.flatMap((session) => trainingDetailRows(session))
    ],
    "Nutrition Stats": [
      ["Date", ...NUTRIENT_EXCEL_HEADERS],
      ...report.days.map((day) => [day.date, ...NUTRIENT_KEYS.map((key) => day.nutrition[key])])
    ],
    "Weekly Report Data": [
      [
        "Date",
        "Calorie Intake",
        "Training Calories",
        "Net Calories",
        "Protein",
        "Strength Volume",
        "Aerobic Distance"
      ],
      ...report.days.map((day) => [
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

export function createWorkbookBlobParts(sheets) {
  return [createWorkbookUint8Array(sheets)];
}

export function createWorkbookBuffer(sheets) {
  const bytes = createWorkbookUint8Array(sheets);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes);
  }
  return bytes;
}

function trainingDetailRows(session) {
  const category = session.category || session.activityType || "";
  const activity = session.activityType || session.category || "";
  const exercises = session.exercises || [];
  const estimatedCalories = calculateTrainingCalories(session);
  const isStrength = category === "strength" || activity === "strength";

  if (isStrength && exercises.length > 0) {
    return exercises.map((exercise) => {
      const sets = exercise.sets || [];
      const reps = sets.reduce((total, set) => total + (Number(set.reps) || 0), 0);
      const maxWeight = sets.reduce((max, set) => Math.max(max, Number(set.weight) || 0), 0);
      return [
        session.date,
        category,
        exercise.name || activity,
        exercise.muscleGroup || "",
        sets.length,
        reps,
        presentValue(maxWeight),
        presentValue(session.durationMinutes),
        presentValue(session.distanceKm),
        session.intensity || "",
        calculateStrengthVolume(sets),
        estimatedCalories,
        session.notes || ""
      ];
    });
  }

  return [
    [
      session.date,
      category,
      session.name || activity,
      "",
      "",
      "",
      "",
      presentValue(session.durationMinutes),
      presentValue(session.distanceKm),
      session.intensity || "",
      0,
      estimatedCalories,
      session.notes || ""
    ]
  ];
}

function presentValue(value) {
  return value === undefined || value === null ? "" : value;
}

function createWorkbookUint8Array(sheets) {
  const sheetNames = Object.keys(sheets);
  const files = [
    { name: "[Content_Types].xml", data: contentTypesXml(sheetNames) },
    { name: "_rels/.rels", data: rootRelsXml() },
    { name: "xl/workbook.xml", data: workbookXml(sheetNames) },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(sheetNames) },
    ...sheetNames.map((name, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: sheetXml(sheets[name])
    }))
  ];

  return createZip(files);
}

export function xmlEscape(value) {
  return stripIllegalXmlControls(String(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripIllegalXmlControls(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

export function cellRef(rowIndex, columnIndex) {
  let column = "";
  let value = columnIndex + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return `${column}${rowIndex + 1}`;
}

export function sheetXml(rows = []) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => cellXml(value, cellRef(rowIndex, columnIndex)))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const maxColumns = Math.max(1, ...rows.map((row) => row.length));
  const ref = rows.length > 0 ? `A1:${cellRef(rows.length - 1, maxColumns - 1)}` : "A1";

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="${ref}"/>`,
    `<sheetData>${sheetRows}</sheetData>`,
    "</worksheet>"
  ].join("");
}

export function workbookXml(sheetNames) {
  const sheets = sheetNames
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<sheets>${sheets}</sheets>`,
    "</workbook>"
  ].join("");
}

export function workbookRelsXml(sheetNames) {
  const relationships = sheetNames
    .map(
      (_name, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    relationships,
    "</Relationships>"
  ].join("");
}

export function contentTypesXml(sheetNames) {
  const worksheets = sheetNames
    .map(
      (_name, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    worksheets,
    "</Types>"
  ].join("");
}

export function rootRelsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>"
  ].join("");
}

function cellXml(value, ref) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

export function crc32(buffer) {
  const bytes = toUint8Array(buffer);
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

export function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime(new Date());

  for (const file of files) {
    const nameBytes = toUint8Array(file.name);
    const data = toUint8Array(file.data);
    const crc = crc32(data);
    const localHeader = zipLocalHeader({ nameBytes, data, crc, dosDate, dosTime });
    const centralHeader = zipCentralHeader({ nameBytes, data, crc, dosDate, dosTime, offset });

    localParts.push(localHeader, nameBytes, data);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = zipEndRecord(files.length, centralSize, offset);
  return concatUint8Arrays([...localParts, ...centralParts, endRecord]);
}

export function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new TextEncoder().encode(String(value ?? ""));
}

function zipLocalHeader({ nameBytes, data, crc, dosDate, dosTime }) {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, ZIP_UTF8_FLAG, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dosTime, true);
  view.setUint16(12, dosDate, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  return header;
}

function zipCentralHeader({ nameBytes, data, crc, dosDate, dosTime, offset }) {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, ZIP_UTF8_FLAG, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, dosTime, true);
  view.setUint16(14, dosDate, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return header;
}

function zipEndRecord(fileCount, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return header;
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
