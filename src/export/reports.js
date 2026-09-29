import { buildWeeklyReport } from "../domain/reports.js?v=44";
import { calculateFoodEntryNutrition } from "../domain/nutrition.js";
import { getDailyDurationRecord } from "../domain/training.js?v=44";
import { createZip, xmlEscape } from "./xlsx.js?v=44";

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ACTIVITY_NAMES = {
  strength: "力量", running: "跑步", cycling: "骑行", walking: "步行", hiking: "徒步",
  hiit: "间歇训练", yoga: "瑜伽", mobility: "灵活性训练", swimming: "游泳", rowing: "划船", other: "其他活动"
};
const MEAL_NAMES = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const AEROBIC_TYPES = new Set(["running", "cycling", "walking", "hiking", "hiit", "swimming", "rowing"]);
const COLORS = ["#8055d9", "#dfad35", "#50a994"];
const FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const number = (value) => String(Math.round((Number(value) || 0) * 100) / 100);
const total = (values) => values.reduce((sum, value) => sum + (Number(value) || 0), 0);

export function buildReportExportData({ weekStart, foodEntries = [], trainingSessions = [] }) {
  const report = buildWeeklyReport({ weekStart, foodEntries, trainingSessions });
  const weekEnd = report.days.at(-1).date;
  const inWeek = (record) => record.date >= weekStart && record.date <= weekEnd;
  const food = foodEntries.filter(inWeek);
  const weeklyTraining = trainingSessions.filter(inWeek);
  const training = weeklyTraining.filter((session) => session.category !== "duration" || session === getDailyDurationRecord(weeklyTraining, session.date));
  const trainingDays = new Set(training.map((session) => session.date)).size;
  const recordedDays = new Set([...food, ...training].map((record) => record.date)).size;
  const categories = [0, 0, 0];
  for (const session of training) {
    if (session.category === "duration") continue;
    if (session.exercises?.length || session.activityType === "strength" || session.category === "strength") categories[0] += 1;
    else if (AEROBIC_TYPES.has(session.activityType)) categories[1] += 1;
    else categories[2] += 1;
  }
  return {
    report, weekEnd, food, training, trainingDays, recordedDays, categories,
    trainingCount: categories.reduce((sum, count) => sum + count, 0),
    totals: {
      intake: total(report.series.calorieIntake), burned: total(report.series.trainingCalories),
      net: total(report.series.netCalories), protein: total(report.series.protein),
      carbs: total(report.days.map((day) => day.nutrition.carbs)),
      fat: total(report.days.map((day) => day.nutrition.fat)),
      duration: total(report.days.map((day) => day.training.durationMinutes)),
      volume: total(report.series.strengthVolume), distance: total(report.series.aerobicDistance)
    }
  };
}

function reportParagraphs(data) {
  const { report, weekEnd, totals, food, training } = data;
  const paragraphs = [
    ["Title", "健身每周文字报告"],
    ["Subtitle", `${report.weekStart} 至 ${weekEnd}`],
    ["Normal", `本报告汇总所选一周已登记的饮食和训练。共有 ${data.recordedDays} 天有记录，食物 ${food.length} 条，训练 ${data.trainingCount} 条，训练天数 ${data.trainingDays} 天。未记录的日期不代表实际没有进食或运动。`],
    ["Heading1", "每周汇总"],
    ["Normal", `摄入热量 ${number(totals.intake)} kcal；训练估算消耗 ${number(totals.burned)} kcal；净热量 ${number(totals.net)} kcal。`],
    ["Normal", `蛋白质 ${number(totals.protein)} g；碳水化合物 ${number(totals.carbs)} g；脂肪 ${number(totals.fat)} g。`],
    ["Normal", `训练时长 ${number(totals.duration)} 分钟；力量容量 ${number(totals.volume)} kg × 次；户外距离 ${number(totals.distance)} km。`],
    ["Normal", "净热量按已记录摄入减去训练估算消耗计算，未扣除基础代谢和其他日常消耗。力量容量为每组重量乘次数后求和。"],
    ["Heading1", "每日明细"]
  ];
  for (const day of report.days) {
    const dayFood = food.filter((entry) => entry.date === day.date);
    const dayTraining = training.filter((entry) => entry.date === day.date);
    const dailyDuration = getDailyDurationRecord(dayTraining, day.date);
    paragraphs.push(["Heading2", day.date]);
    if (!dayFood.length && !dayTraining.length) {
      paragraphs.push(["Normal", "当天没有登记记录。"]);
      continue;
    }
    paragraphs.push(["Normal", `摄入 ${number(day.nutrition.calories)} kcal；训练估算消耗 ${number(day.training.calories)} kcal；净热量 ${number(day.netCalories)} kcal。`]);
    paragraphs.push(["Normal", `蛋白质 ${number(day.nutrition.protein)} g；碳水化合物 ${number(day.nutrition.carbs)} g；脂肪 ${number(day.nutrition.fat)} g。`]);
    if (dailyDuration && dayTraining.some((session) => session.category !== "duration" && Number(session.durationMinutes))) {
      paragraphs.push(["Normal", "本日时长和估算消耗采用当天总时长，旧动作记录中的时长不再重复累计。"]);
    }
    for (const entry of dayFood) {
      paragraphs.push(["Normal", `${MEAL_NAMES[entry.meal] || entry.meal || "食物"}：${entry.name || "未命名食物"}，${number(entry.grams)} g，${number(calculateFoodEntryNutrition(entry).totals.calories)} kcal。`]);
    }
    for (const session of dayTraining) {
      if (session.category === "duration") {
        paragraphs.push(["Normal", `当日总时长：${number(session.durationMinutes)} 分钟；主要活动 ${ACTIVITY_NAMES[session.activityType] || "其他活动"}${session.notes ? `；备注 ${session.notes}` : ""}。`]);
        continue;
      }
      const exerciseDetails = (session.exercises || []).map((exercise) => {
        const sets = (exercise.sets || []).map((set) => `${number(set.weight)} kg × ${number(set.reps)} 次`).join("；");
        return `${exercise.name || "力量动作"}${sets ? `（${sets}）` : ""}`;
      }).join("；");
      paragraphs.push(["Normal", `训练：${exerciseDetails || ACTIVITY_NAMES[session.activityType] || "其他活动"}${!dailyDuration && Number(session.durationMinutes) ? `；时长 ${number(session.durationMinutes)} 分钟` : ""}${Number(session.distanceKm) ? `；距离 ${number(session.distanceKm)} km` : ""}${session.notes ? `；备注 ${session.notes}` : ""}。`]);
    }
  }
  return paragraphs;
}

export function createReportDocxBuffer(input) {
  const paragraphs = reportParagraphs(buildReportExportData(input));
  const body = paragraphs.map(([style, text]) => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`).join("");
  const namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const styles = [
    ["Normal", "Normal", 22, false, "111827", 120], ["Title", "Title", 40, true, "000000", 220],
    ["Subtitle", "Subtitle", 22, false, "616778", 240], ["Heading1", "heading 1", 28, true, "272338", 180],
    ["Heading2", "heading 2", 24, true, "272338", 120]
  ].map(([id, name, size, bold, color, after]) => `<w:style w:type="paragraph" w:styleId="${id}"${id === "Normal" ? ' w:default="1"' : ""}><w:name w:val="${name}"/>${id !== "Normal" ? '<w:basedOn w:val="Normal"/>' : ""}<w:pPr><w:wordWrap w:val="0"/><w:spacing w:after="${after}" w:line="320" w:lineRule="auto"/>${id.startsWith("Heading") || id === "Title" ? '<w:keepNext/><w:keepLines/>' : ""}${id.startsWith("Heading") ? `<w:outlineLvl w:val="${Number(id.at(-1)) - 1}"/>` : ""}</w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="PingFang SC"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:color w:val="${color}"/>${bold ? "<w:b/>" : ""}<w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:style>`).join("");
  return createZip([
    { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: "word/document.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${namespace}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>` },
    { name: "word/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${namespace}">${styles}</w:styles>` },
    { name: "word/_rels/document.xml.rels", data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' }
  ]);
}

function drawText(context, text, x, y, size = 24, color = "#242238", bold = false) {
  context.font = `${bold ? "600" : "400"} ${size}px ${FONT}`;
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function drawChart(context, { title, labels, series, unit }, x, y, width, height) {
  context.fillStyle = "#f7f6fa";
  context.fillRect(x, y, width, height);
  drawText(context, title, x + 26, y + 42, 27, "#242238", true);
  drawText(context, unit, x + 26, y + 76, 19, "#6c687a");
  series.forEach((item, index) => {
    const legendX = x + 26 + index * 160;
    context.fillStyle = COLORS[index];
    context.fillRect(legendX, y + 101, 15, 15);
    drawText(context, item.label, legendX + 23, y + 116, 18, "#6c687a");
  });
  const values = series.flatMap((item) => item.values);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const plot = { left: x + 78, right: x + width - 24, top: y + 160, bottom: y + height - 70 };
  const toY = (value) => plot.bottom - (value - min) / (max - min) * (plot.bottom - plot.top);
  context.strokeStyle = "#ddd9e6";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const value = min + (max - min) * index / 4;
    const row = toY(value);
    context.beginPath();
    context.moveTo(plot.left, row);
    context.lineTo(plot.right, row);
    context.stroke();
    context.textAlign = "right";
    drawText(context, Math.abs(value) >= 1000 ? `${number(value / 1000)}k` : number(value), plot.left - 10, row + 6, 16, "#797586");
  }
  const step = (plot.right - plot.left) / labels.length;
  const barWidth = Math.min(42, step * 0.65 / series.length);
  labels.forEach((label, index) => {
    const middle = plot.left + step * (index + 0.5);
    context.textAlign = "center";
    drawText(context, label, middle, plot.bottom + 34, 17, "#797586");
    series.forEach((item, seriesIndex) => {
      const value = item.values[index] || 0;
      const barX = middle - (barWidth * series.length) / 2 + barWidth * seriesIndex;
      const zeroY = toY(0);
      const valueY = toY(value);
      context.fillStyle = value < 0 ? COLORS[2] : COLORS[seriesIndex];
      context.fillRect(barX + 2, Math.min(zeroY, valueY), barWidth - 4, Math.max(value === 0 ? 0 : 2, Math.abs(zeroY - valueY)));
    });
  });
  context.textAlign = "left";
  if (values.every((value) => value === 0)) drawText(context, "本周暂无已登记数值", x + 26, y + height - 22, 17, "#797586");
}

function drawReportPage(data, pageIndex) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备暂时无法生成 PDF 图表。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const { report, totals } = data;
  drawText(context, "健身每周报告", 68, 107, 48, "#242238", true);
  drawText(context, `${report.weekStart} 至 ${data.weekEnd}`, 70, 158, 25, "#797586");
  drawText(context, pageIndex === 0 ? "营养与热量" : "训练与活动", 70, 222, 30, "#8055d9", true);
  const metrics = pageIndex === 0
    ? [["摄入热量", totals.intake, "kcal"], ["训练估算消耗", totals.burned, "kcal"], ["净热量", totals.net, "kcal"]]
    : [["训练天数", data.trainingDays, "天"], ["训练时长", totals.duration, "分钟"], ["力量容量", totals.volume, "kg × 次"]];
  metrics.forEach(([label, value, unit], index) => {
    const x = 70 + index * 380;
    drawText(context, label, x, 280, 21, "#797586");
    drawText(context, number(value), x, 331, 40, "#242238", true);
    drawText(context, unit, x, 368, 20, "#797586");
  });
  const labels = report.series.dates.map((date) => date.slice(5));
  const oneSeries = (label, values) => [{ label, values }];
  const charts = pageIndex === 0 ? [
    { title: "热量摄入与训练", labels, unit: "kcal", series: [{ label: "摄入", values: report.series.calorieIntake }, { label: "训练消耗", values: report.series.trainingCalories }] },
    { title: "每日净热量", labels, unit: "kcal", series: oneSeries("净热量", report.series.netCalories) },
    { title: "每日蛋白质", labels, unit: "g", series: oneSeries("蛋白质", report.series.protein) },
    { title: "每周宏量营养", labels: ["蛋白质", "碳水", "脂肪"], unit: "g", series: oneSeries("周总量", [totals.protein, totals.carbs, totals.fat]) }
  ] : [
    { title: "每日力量容量", labels, unit: "kg × 次", series: oneSeries("力量容量", report.series.strengthVolume) },
    { title: "每日户外距离", labels, unit: "km", series: oneSeries("距离", report.series.aerobicDistance) },
    { title: "每日户外时长", labels, unit: "分钟", series: oneSeries("时长", report.series.aerobicDuration) },
    { title: "训练记录分类", labels: ["力量", "有氧", "其他"], unit: "条记录", series: oneSeries("登记次数", data.categories) }
  ];
  charts.forEach((chart, index) => drawChart(context, chart, 68 + (index % 2) * 562, 414 + Math.floor(index / 2) * 550, 542, 526));
  drawText(context, `本周有 ${data.recordedDays} 天已登记；未登记日期不代表实际没有进食或运动。`, 70, 1570, 22, "#797586");
  drawText(context, "净热量 = 已记录摄入 - 训练估算消耗，不含基础代谢及其他日常消耗。", 70, 1608, 22, "#797586");
  drawText(context, `${pageIndex + 1} / 2`, 1110, 1686, 21, "#797586");
  return canvas;
}

export async function createReportPdfBuffer(input) {
  await document.fonts?.ready;
  const data = buildReportExportData(input);
  const pages = [0, 1].map((index) => {
    const canvas = drawReportPage(data, index);
    const encoded = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
    const jpeg = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return { jpeg, width: canvas.width, height: canvas.height };
  });
  return createPdfFromJpegPages(pages);
}

// Embed full-resolution chart pages, preserving Chinese glyphs without a font download.
export function createPdfFromJpegPages(pages) {
  const encoder = new TextEncoder();
  const objects = [encoder.encode("<< /Type /Catalog /Pages 2 0 R >>")];
  const kids = pages.map((_page, index) => `${3 + index * 3} 0 R`).join(" ");
  objects.push(encoder.encode(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  pages.forEach(({ jpeg, width, height }, index) => {
    const id = 3 + index * 3;
    objects.push(encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`));
    const commands = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
    objects.push(encoder.encode(`<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`));
    const prefix = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    objects.push(concatBytes([prefix, jpeg, encoder.encode("\nendstream")]));
  });
  const parts = [encoder.encode("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n")];
  let offset = parts[0].length;
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(offset);
    const part = concatBytes([encoder.encode(`${index + 1} 0 obj\n`), object, encoder.encode("\nendobj\n")]);
    parts.push(part);
    offset += part.length;
  });
  const entries = offsets.map((position, index) => `${String(position).padStart(10, "0")} ${index ? "00000 n" : "65535 f"} \n`).join("");
  parts.push(encoder.encode(`xref\n0 ${offsets.length}\n${entries}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return concatBytes(parts);
}

function concatBytes(parts) {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
