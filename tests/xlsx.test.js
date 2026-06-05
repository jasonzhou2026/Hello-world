import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExportRows,
  createWorkbookBlobParts,
  createWorkbookBuffer,
  crc32
} from "../src/export/xlsx.js";

const NUTRIENT_HEADERS = [
  "Calories",
  "Protein",
  "Carbohydrate",
  "Fat",
  "Fiber",
  "Sugar",
  "Sodium",
  "Calcium",
  "Iron",
  "Magnesium",
  "Potassium",
  "Zinc",
  "Vitamin A",
  "Vitamin C",
  "Vitamin D",
  "Vitamin B12"
];

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

  assert.deepEqual(rows["Daily Summary"][0], [
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
  ]);
  assert.deepEqual(rows["Food Details"][0], [
    "Date",
    "Meal",
    "Food",
    "Serving Grams",
    ...NUTRIENT_HEADERS,
    "Source"
  ]);
  assert.deepEqual(rows["Training Details"][0], [
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
  ]);
  assert.deepEqual(rows["Nutrition Stats"][0], ["Date", ...NUTRIENT_HEADERS]);
  assert.deepEqual(rows["Weekly Report Data"][0], [
    "Date",
    "Calorie Intake",
    "Training Calories",
    "Net Calories",
    "Protein",
    "Strength Volume",
    "Aerobic Distance"
  ]);

  const foodRow = rows["Food Details"][1];
  assert.equal(foodRow[1], "lunch");
  assert.equal(foodRow[2], "鸡胸饭");
  assert.equal(foodRow[3], 300);
  assert.deepEqual(foodRow.slice(4, 20), [540, 36, 72, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(foodRow.at(-1), "manual");

  const trainingRow = rows["Training Details"][1];
  assert.equal(trainingRow[2], "深蹲");
  assert.equal(trainingRow[3], "腿");
  assert.equal(trainingRow[4], 1);
  assert.equal(trainingRow[5], 5);
  assert.equal(trainingRow[6], 80);
  assert.equal(trainingRow[10], 400);
});

test("creates an xlsx zip buffer with workbook files", () => {
  const sheets = {
    "Daily Summary": [["Date", "Calories"], ["2026-06-04", 200]],
    "Food Details": [["Food"], ["鸡胸饭"]]
  };

  const parts = createWorkbookBlobParts(sheets);
  const buffer = createWorkbookBuffer(sheets);
  const zip = parseZip(buffer);
  const expectedEntries = [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml"
  ];

  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
  assert.ok(parts.length > 0);
  assert.deepEqual(zip.entries.map((entry) => entry.name), expectedEntries);

  for (const entry of zip.entries) {
    assert.equal(entry.method, 0);
    assert.equal(entry.flags & 0x0800, 0x0800);
    assert.equal(entry.compressedSize, entry.uncompressedSize);
    assert.equal(entry.localName, entry.name);
    assert.equal(entry.crc, crc32(entry.payload));
    assert.equal(new TextDecoder("utf-8", { fatal: true }).decode(entry.payload), entry.text);
  }
});

test("writes escaped UTF-8 XML payloads for workbook sheets and relationships", () => {
  const specialText = `鸡胸饭 & <tag> "quote" 'apostrophe' bad\u0001char`;
  const sheets = {
    "Daily Summary": [["Name"], [specialText]],
    "Food Details": [["Food"], [" leading and trailing "]]
  };
  const zip = parseZip(createWorkbookBuffer(sheets));
  const files = Object.fromEntries(zip.entries.map((entry) => [entry.name, entry.text]));

  assert.ok(files["xl/worksheets/sheet1.xml"].includes("鸡胸饭"));
  assert.ok(files["xl/worksheets/sheet1.xml"].includes("&amp;"));
  assert.ok(files["xl/worksheets/sheet1.xml"].includes("&lt;tag&gt;"));
  assert.ok(files["xl/worksheets/sheet1.xml"].includes("&quot;quote&quot;"));
  assert.ok(files["xl/worksheets/sheet1.xml"].includes("&apos;apostrophe&apos;"));
  assert.ok(!files["xl/worksheets/sheet1.xml"].includes("\u0001"));
  assert.ok(files["xl/worksheets/sheet1.xml"].includes('t="inlineStr"'));
  assert.ok(files["xl/worksheets/sheet2.xml"].includes('xml:space="preserve"'));

  assert.ok(files["xl/workbook.xml"].includes('name="Daily Summary"'));
  assert.ok(files["xl/workbook.xml"].includes('name="Food Details"'));
  assert.ok(files["xl/workbook.xml"].includes('r:id="rId1"'));
  assert.ok(files["xl/workbook.xml"].includes('r:id="rId2"'));
  assert.ok(files["xl/_rels/workbook.xml.rels"].includes('Target="worksheets/sheet1.xml"'));
  assert.ok(files["xl/_rels/workbook.xml.rels"].includes('Target="worksheets/sheet2.xml"'));
  assert.ok(files["[Content_Types].xml"].includes('PartName="/xl/worksheets/sheet1.xml"'));
  assert.ok(files["[Content_Types].xml"].includes('PartName="/xl/worksheets/sheet2.xml"'));
});

function parseZip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const eocdOffset = findEndOfCentralDirectory(view);
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = [];
  let offset = centralDirectoryOffset;

  while (offset < centralDirectoryOffset + centralDirectorySize) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const crc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
    const name = decoder.decode(nameBytes);
    const local = parseLocalEntry({ bytes, view, decoder, localHeaderOffset, compressedSize });

    entries.push({
      name,
      flags,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      localName: local.name,
      payload: local.payload,
      text: decoder.decode(local.payload)
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  assert.equal(entries.length, entryCount);
  return { entries };
}

function parseLocalEntry({ bytes, view, decoder, localHeaderOffset, compressedSize }) {
  assert.equal(view.getUint32(localHeaderOffset, true), 0x04034b50);

  const fileNameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const nameStart = localHeaderOffset + 30;
  const nameEnd = nameStart + fileNameLength;
  const payloadStart = nameEnd + extraLength;
  const payloadEnd = payloadStart + compressedSize;

  return {
    name: decoder.decode(bytes.subarray(nameStart, nameEnd)),
    payload: bytes.subarray(payloadStart, payloadEnd)
  };
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  assert.fail("ZIP end of central directory was not found");
}
