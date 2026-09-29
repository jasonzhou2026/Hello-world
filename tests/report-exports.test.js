import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportExportData,
  createReportDocxBuffer,
  createPdfFromJpegPages
} from "../src/export/reports.js";

const input = {
  weekStart: "2026-09-28",
  foodEntries: [
    { date: "2026-09-28", meal: "lunch", name: "米饭 & <蔬菜>", grams: 200, nutrientsPer100g: { calories: 100, protein: 5, carbs: 20, fat: 1 } },
    { date: "2026-10-04", name: "周日食物", grams: 100, nutrientsPer100g: { calories: 50 } },
    { date: "2026-10-05", name: "下周食物不应导出", grams: 100, nutrientsPer100g: { calories: 900 } }
  ],
  trainingSessions: [
    { date: "2026-09-29", category: "strength", activityType: "strength", bodyWeightKg: 60, durationMinutes: 60, exercises: [{ name: "深蹲", sets: [{ reps: 10, weight: 40 }] }] },
    { date: "2026-09-30", category: "outdoor", activityType: "walking", bodyWeightKg: 60, durationMinutes: 30, distanceKm: 2 },
    { date: "2026-09-27", activityType: "running", notes: "上周训练不应导出", durationMinutes: 40 }
  ]
};

test("report exports use only the selected week and preserve missing-day semantics", () => {
  const data = buildReportExportData(input);
  assert.equal(data.weekEnd, "2026-10-04");
  assert.equal(data.food.length, 2);
  assert.equal(data.training.length, 2);
  assert.equal(data.recordedDays, 4);
  assert.equal(data.trainingDays, 2);
  assert.deepEqual(data.categories, [1, 1, 0]);
  assert.deepEqual(data.totals, { intake: 250, burned: 420, net: -170, protein: 10, carbs: 40, fat: 2, duration: 90, volume: 400, distance: 2 });
});

test("DOCX contains relationships, readable Chinese, safely escaped text and complete daily details", () => {
  const bytes = createReportDocxBuffer(input);
  const files = unzipStoredEntries(bytes);
  assert.deepEqual(Object.keys(files), ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels"]);
  assert.match(files["[Content_Types].xml"], /wordprocessingml.document.main\+xml/);
  assert.match(files["_rels/.rels"], /Target="word\/document.xml"/);
  assert.match(files["word/_rels/document.xml.rels"], /Target="styles.xml"/);
  const document = files["word/document.xml"];
  assert.match(document, /w:pStyle w:val="Title"/);
  assert.match(document, /健身每周文字报告/);
  assert.match(document, /净热量 -170 kcal/);
  assert.match(document, /米饭 &amp; &lt;蔬菜&gt;/);
  assert.match(document, /深蹲（40 kg × 10 次）/);
  assert.match(document, /周日食物/);
  assert.match(document, /当天没有登记记录/);
  assert.doesNotMatch(document, /下周食物不应导出|上周训练不应导出/);
  assert.equal((document.match(/w:pStyle w:val="Heading2"/g) || []).length, 7);
});

test("empty weeks remain exportable without invented activity or data", () => {
  const empty = { weekStart: "2026-09-28" };
  const data = buildReportExportData(empty);
  assert.equal(data.recordedDays, 0);
  assert.equal(data.trainingDays, 0);
  const document = unzipStoredEntries(createReportDocxBuffer(empty))["word/document.xml"];
  assert.match(document, /共有 0 天有记录/);
  assert.equal((document.match(/当天没有登记记录/g) || []).length, 7);
});

test("daily duration records appear once as a daily total and do not inflate workout counts", () => {
  const records = { weekStart: "2026-09-28", trainingSessions: [
    { date: "2026-09-29", category: "strength", activityType: "strength", exercises: [{ name: "卧推", sets: [{ weight: 20, reps: 10 }] }], durationMinutes: 0 },
    { date: "2026-09-29", category: "duration", activityType: "strength", durationMinutes: 60, bodyWeightKg: 60 }
  ] };
  const data = buildReportExportData(records);
  assert.equal(data.trainingCount, 1);
  assert.equal(data.trainingDays, 1);
  assert.deepEqual(data.categories, [1, 0, 0]);
  const document = unzipStoredEntries(createReportDocxBuffer(records))["word/document.xml"];
  assert.match(document, /当日总时长：60 分钟/);
  assert.match(document, /训练 1 条/);
  assert.doesNotMatch(document, /；时长 0 分钟/);
});

test("PDF cross-reference offsets and stream byte lengths remain correct with binary images", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0, 0x80, 0xff, 0xd9]);
  const bytes = createPdfFromJpegPages([{ jpeg, width: 100, height: 200 }, { jpeg, width: 300, height: 400 }]);
  const decode = (start, end) => new TextDecoder().decode(bytes.subarray(start, end));
  const text = decode(0);
  assert.match(text, /^%PDF-1.4/);
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/Kids \[3 0 R 6 0 R\]/);
  assert.match(text, /\/Filter \/DCTDecode \/Length 6/);
  const xrefOffset = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(decode(xrefOffset, xrefOffset + 4), "xref");
  const xref = decode(xrefOffset).split("\n");
  assert.equal(xref[1], "0 9");
  for (let id = 1; id <= 8; id += 1) {
    const offset = Number(xref[2 + id].slice(0, 10));
    assert.equal(decode(offset, offset + `${id} 0 obj`.length), `${id} 0 obj`);
  }
});

test("PDF chart categories agree with UI aerobic and other activity classification", () => {
  const data = buildReportExportData({ weekStart: "2026-09-28", trainingSessions: [
    { date: "2026-09-29", activityType: "running" },
    { date: "2026-09-29", activityType: "swimming" },
    { date: "2026-09-29", activityType: "yoga" },
    { date: "2026-09-29", activityType: "mobility" },
    { date: "2026-09-29", activityType: "other" },
    { date: "2026-09-29", activityType: "strength" },
    { date: "2026-09-29", category: "duration", activityType: "strength", durationMinutes: 60 }
  ] });
  assert.deepEqual(data.categories, [1, 2, 3]);
  assert.equal(data.trainingCount, 6);
});

test("PDF and DOCX use only the effective daily total and explain omitted legacy times", () => {
  const records = { weekStart: "2026-09-28", trainingSessions: [
    { date: "2026-09-29", category: "strength", activityType: "strength", exercises: [{ name: "卧推", sets: [{ weight: 20, reps: 10 }] }], durationMinutes: 45, bodyWeightKg: 60 },
    { id: "old", date: "2026-09-29", category: "duration", activityType: "running", durationMinutes: 90, bodyWeightKg: 60, notes: "旧总时长不应出现", updatedAt: "2026-09-29T10:00:00Z" },
    { id: "new", date: "2026-09-29", category: "duration", activityType: "strength", durationMinutes: 60, bodyWeightKg: 60, updatedAt: "2026-09-29T12:00:00Z" }
  ] };
  const data = buildReportExportData(records);
  assert.equal(data.training.filter((session) => session.category === "duration").length, 1);
  assert.equal(data.totals.duration, 60);
  assert.equal(data.totals.burned, 300);
  assert.equal(data.trainingCount, 1);
  const document = unzipStoredEntries(createReportDocxBuffer(records))["word/document.xml"];
  assert.equal((document.match(/当日总时长：/g) || []).length, 1);
  assert.match(document, /当日总时长：60 分钟/);
  assert.match(document, /旧动作记录中的时长不再重复累计/);
  assert.doesNotMatch(document, /时长 45 分钟|旧总时长不应出现|总时长：90/);
});

function unzipStoredEntries(bytes) {
  const result = {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const payloadStart = offset + 30 + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    result[name] = decoder.decode(bytes.subarray(payloadStart, payloadStart + size));
    offset = payloadStart + size;
  }
  return result;
}
