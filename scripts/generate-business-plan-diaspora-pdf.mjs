import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "docs", "business-plan", "Strehe-Prona-Diaspora-Business-Plan.pdf");

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const COLORS = {
  ink: rgb(0.1, 0.11, 0.14),
  muted: rgb(0.43, 0.47, 0.52),
  border: rgb(0.83, 0.87, 0.91),
  brand: rgb(0.07, 0.29, 0.5),
  brandSoft: rgb(0.92, 0.96, 1),
  green: rgb(0.11, 0.49, 0.32),
  greenSoft: rgb(0.92, 0.98, 0.95),
  amber: rgb(0.76, 0.49, 0.09),
  amberSoft: rgb(1, 0.97, 0.9),
  red: rgb(0.72, 0.22, 0.19),
  redSoft: rgb(0.99, 0.93, 0.92),
  slateSoft: rgb(0.96, 0.97, 0.98),
  white: rgb(1, 1, 1),
};

const months = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
const customers = [5, 8, 12, 17, 23, 30, 37, 45, 54, 63, 72, 82];
const recurringRevenue = [187, 309, 477, 719, 1003, 1330, 1678, 2065, 2479, 2927, 3396, 3895];
const addonsRevenue = [70, 120, 180, 260, 360, 470, 600, 760, 930, 1110, 1290, 1500];
const totalRevenue = recurringRevenue.map((v, i) => v + addonsRevenue[i]);
const operatingExpenses = [1310, 1320, 1340, 1370, 1410, 1460, 1510, 1570, 1640, 1710, 1780, 1860];
const monthlyNet = totalRevenue.map((v, i) => v - operatingExpenses[i]);
const openingReserve = 4500;
const endingCash = monthlyNet.reduce((acc, value) => {
  const last = acc[acc.length - 1] ?? openingReserve;
  acc.push(last + value);
  return acc;
}, []);

const packageRows = [
  ["Essential", "EUR 29 / month", "1 visit, basic control, ventilation, utilities / windows / door check, 5-10 photos, short video, WhatsApp or email report"],
  ["Care", "EUR 49 / month", "2 visits, richer report, immediate issue notice, 30 minutes of small monthly work like bulb replacement or reset"],
  ["Premium", "EUR 79 / month", "Up to 4 visits, detailed reporting, highest priority, worker coordination, discount on extras, possible annual arrival-prep promo"],
];

const addOnRows = [
  ["Arrival Ready A", "EUR 50-60", "Ventilation, basic control, batteries, lights, AC check"],
  ["Arrival Ready B", "EUR 150", "A plus vacuum, dusting, toilet clean"],
  ["Arrival Ready C", "EUR 250-300", "B plus dish washing, curtain washing, carpet washing, deeper general clean"],
  ["Bill and Utility Management", "EUR 9-15 / active month", "Collect, remind, pay with authorization, recharge expense plus service fee"],
  ["Renovation Oversight", "EUR 150-300 or 10-15%", "Fixed fee for small projects, management fee for larger ones"],
];

const acquisitionRows = [
  ["Months 1-2", "Warm diaspora network", "Use family circles, personal trust, WhatsApp introductions, first report examples", "First 5-8 customers"],
  ["Months 2-4", "Video-led trust content", "Short videos explaining checks, reports, key safety, arrival prep", "Higher credibility"],
  ["Months 3-6", "Referral loop", "Ask every satisfied owner for 1-2 referrals", "Low-cost acquisition"],
  ["Months 4-8", "Builder and furnishing contacts", "Leverage people already serving diaspora owners", "Qualified leads"],
  ["Months 6-12", "Cluster selling", "Sell multiple units per owner and adjacent-building routes", "Better route economics"],
];

const marketRows = [
  ["Housing stock proxy in target corridor", "Prishtina 88,530 + Fushe Kosove 27,707 = 116,237"],
  ["Verified context", "CBK says 80.8% of Q2 2025 FDI was in real estate, driven largely by diaspora demand"],
  ["Verified context", "ASK-based reporting says Kosovo had about 182,849 uninhabited homes in 2024 census results"],
  ["Planning caution", "Exact share of diaspora-owned apartments is not verified and should be treated as founder market insight unless confirmed later"],
];

const scenarioRows = [
  ["10% of corridor stock fits niche", "11,624", "232 clients"],
  ["20% of corridor stock fits niche", "23,247", "465 clients"],
  ["30% of corridor stock fits niche", "34,871", "697 clients"],
  ["50% of corridor stock fits niche", "58,119", "1,162 clients"],
];

const startupBudget = [
  ["Registration and setup", 300],
  ["Space preparation", 350],
  ["Office basics", 900],
  ["Shelves and zoning", 700],
  ["Business PC", 1000],
  ["Starter tools", 1000],
  ["Workwear / PPE", 250],
  ["Document safe", 250],
  ["Key cabinet / safe", 350],
  ["Website and brand", 500],
  ["Launch marketing", 500],
  ["Transport buffer", 400],
  ["Contractor float", 1000],
  ["Working capital reserve", 4500],
];

const swotRows = [
  ["Strengths", "Clear diaspora niche, recurring packages, internal software, free premises, trust-based service logic"],
  ["Weaknesses", "New brand, founder-heavy execution, trust barrier early, limited proof at launch"],
  ["Opportunities", "Large vacant or intermittently used apartment stock, diaspora real-estate linkage, Fushe Kosove expansion, high-value add-ons"],
  ["Threats", "Informal competitors, underpricing, contractor reliability issues, slow market education"],
];

const teamRows = [
  ["Managing Founder / Operations Lead", "Service design, daily operations, customer communication, visit standards, contractor coordination, app workflow"],
  ["Co-Founder / Growth and Brand Lead", "Brand, social media, content, website presentation, acquisition support, trust-building materials"],
  ["Finance / Admin Support", "Bookkeeping, invoicing, cash tracking, administrative discipline"],
  ["Contractor Network", "Electricians, plumbers, cleaners, builders, and specialists engaged when required"],
];

const growthTeamRows = [
  ["Phase 1: Launch", "2 active founders + finance/admin support + contractor network"],
  ["Phase 2: Early traction", "Add 1 field operations assistant or property visit officer when route density justifies it"],
  ["Phase 3: Growth", "Stronger field support, admin/finance assistance, and more formal scheduling and contractor coordination"],
];

const sources = [
  "CBK Quarterly Assessment of the Economy Q2 2025",
  "Government of Kosovo 2024 census result releases",
  "World Bank Kosovo country data",
  "ASK-cited reporting on uninhabited homes",
  "ASK-cited reporting on housing stock in Prishtina and Fushe Kosove",
];

const staffingRows = [
  ["0-35 active clients", "2 founders + admin/finance support + contractors", "Founders can still control visits, quality, and reporting directly"],
  ["35-80 active clients", "Same core team, tighter process", "Need stronger templates, route planning, and monitoring for overload"],
  ["80-140 active clients", "Add 1 field operations assistant", "First real need for recurring field support"],
  ["140-220 active clients", "Add second field support / inspector", "Scheduling and visit consistency start to pressure the founders"],
  ["220-350 active clients", "Add admin / client coordination support", "Service becomes a real operations structure, not just founder hustle"],
  ["350+ active clients", "Multi-field team + dedicated coordination", "Requires formal route management, training, and stronger supervision"],
];

const routeRows = [
  ["Route 1: Lean premium-control", "Smaller base, stronger quality, more premium positioning", "Protects trust but scales slower"],
  ["Route 2: Balanced recurring growth", "Recurring packages first, add-ons lift economics, hiring when justified", "Best fit for Strehe-Prona"],
  ["Route 3: Aggressive scale", "Faster acquisition and earlier staffing", "Highest risk of quality slips and reputation damage"],
];

const triggerRows = [
  ["Reporting speed starts slipping", "Standardize templates, slow growth pressure, review workload"],
  ["Response time gets slower", "Tighten routes and add field support planning"],
  ["Founders lose time for sales and quality control", "Shift repetitive visits to field support"],
  ["Complaints or issue-recurrence rises", "Pause scaling and fix operations first"],
];

const financialModelRows = [
  ["Conservative", "Y1: 20-35 | Y2: 60-90 | Y3: 120-160", "Slower trust-building, lower pressure, more process-refinement time"],
  ["Base", "Y1: 35-50 | Y2: 90-140 | Y3: 180-250", "Most useful planning route and strongest working base case"],
  ["Ambitious", "Y1: 50-70 | Y2: 150-220 | Y3: 300+", "Possible only with very strong referrals and disciplined scaling"],
];

const year3EconomicsRows = [
  ["Conservative", "140", euro(7700), euro(92400)],
  ["Base", "220", euro(12100), euro(145200)],
  ["Strong Base", "250", euro(13750), euro(165000)],
  ["Ambitious", "320", euro(17600), euro(211200)],
];

const kpiRows = [
  ["Revenue KPIs", "Active clients, net new clients, churn, monthly recurring revenue, add-on revenue, revenue per client"],
  ["Operations KPIs", "Visits completed, on-time visit rate, response time, report completion time, issues found per 100 visits"],
  ["Customer KPIs", "Referral rate, complaint count, time to resolution, repeat add-on purchase rate, Premium share"],
  ["Team KPIs", "Founder field time vs coordination time, field visit capacity, contractor issue rate, rework rate"],
];

const sopRows = [
  ["Standard Monthly Visit", "Route, timestamp, checklist, photos, short video, issue notes, report, log in system"],
  ["Issue Escalation", "Classify urgency, notify client, propose action, assign path, document outcome"],
  ["Arrival Ready", "Confirm arrival, confirm package, schedule prep, verify readiness, final report"],
  ["Bill and Utility Handling", "Collect bill, confirm authorization, pay, send proof, record service fee and reimbursement"],
  ["Renovation Oversight", "Define scope, fee model, reporting rhythm, milestone checks, issue logging, close-out"],
];

const year3Clients = [232, 465, 697, 1162];
const year3Revenue = [12760, 25575, 38335, 63910];
const year3Visits = [441, 884, 1324, 2208];

function euro(value) {
  return `EUR ${Math.round(value).toLocaleString("en-GB")}`;
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function main() {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = [];

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  pages.push(page);

  function newPage() {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
    pages.push(page);
  }

  function ensureSpace(height) {
    if (y - height < MARGIN) newPage();
  }

  function drawTextBlock(text, x, topY, options = {}) {
    const font = options.font ?? regular;
    const size = options.size ?? 10.5;
    const color = options.color ?? COLORS.ink;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size + 3.5;
    const lines = wrapText(text, font, size, maxWidth);
    let currentY = topY;
    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
    }
    return currentY;
  }

  function drawSectionTitle(title, subtitle) {
    ensureSpace(56);
    page.drawText(title, { x: MARGIN, y, size: 15.5, font: bold, color: COLORS.brand });
    y -= 18;
    if (subtitle) y = drawTextBlock(subtitle, MARGIN, y, { size: 9.7, color: COLORS.muted, lineHeight: 12.5 });
    y -= 10;
  }

  function drawParagraph(text, options = {}) {
    const size = options.size ?? 10.3;
    const lineHeight = options.lineHeight ?? size + 3.4;
    const spacing = options.spacing ?? 8;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    const needed = wrapText(text, options.font ?? regular, size, maxWidth).length * lineHeight + spacing;
    ensureSpace(needed);
    y = drawTextBlock(text, options.x ?? MARGIN, y, {
      font: options.font ?? regular,
      size,
      color: options.color ?? COLORS.ink,
      maxWidth,
      lineHeight,
    });
    y -= spacing;
  }

  function drawBulletList(items, options = {}) {
    const bulletX = options.x ?? MARGIN;
    const textX = bulletX + 12;
    const maxWidth = (options.maxWidth ?? CONTENT_WIDTH) - 12;
    for (const item of items) {
      const size = options.size ?? 10.1;
      const lineHeight = options.lineHeight ?? size + 3.2;
      const needed = wrapText(item, regular, size, maxWidth).length * lineHeight + 5;
      ensureSpace(needed);
      page.drawText("-", { x: bulletX, y, size, font: bold, color: COLORS.brand });
      y = drawTextBlock(item, textX, y, { size, maxWidth, lineHeight });
      y -= 4;
    }
  }

  function drawCardRow(cards) {
    const gap = 12;
    const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
    const height = 90;
    ensureSpace(height + 10);
    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      const tone = card.tone || "brand";
      const fill = tone === "green" ? COLORS.greenSoft : tone === "amber" ? COLORS.amberSoft : tone === "red" ? COLORS.redSoft : COLORS.brandSoft;
      const ink = tone === "green" ? COLORS.green : tone === "amber" ? COLORS.amber : tone === "red" ? COLORS.red : COLORS.brand;
      page.drawRectangle({ x, y: y - height + 6, width, height, color: fill, borderColor: COLORS.border, borderWidth: 1 });
      page.drawText(card.label, { x: x + 12, y: y - 16, size: 9, font: bold, color: ink });
      page.drawText(card.value, { x: x + 12, y: y - 40, size: 18, font: bold, color: COLORS.ink });
      if (card.note) drawTextBlock(card.note, x + 12, y - 57, { size: 8.2, color: COLORS.muted, maxWidth: width - 24, lineHeight: 10.5 });
    });
    y -= height + 12;
  }

  function drawSimpleTable(columns, rows, options = {}) {
    const headerHeight = 22;
    const rowPadding = 5;
    const fontSize = options.fontSize ?? 8.8;
    const lineHeight = options.lineHeight ?? 11;
    const columnWidths = columns.map((c) => c.width);
    const tableWidth = columnWidths.reduce((sum, value) => sum + value, 0);
    const rowHeights = rows.map((row) => Math.max(...row.map((cell, i) => wrapText(String(cell), regular, fontSize, columnWidths[i] - 10).length * lineHeight + rowPadding * 2), 20));
    const totalHeight = headerHeight + rowHeights.reduce((sum, value) => sum + value, 0);
    ensureSpace(totalHeight + 10);

    page.drawRectangle({ x: MARGIN, y: y - headerHeight, width: tableWidth, height: headerHeight, color: COLORS.slateSoft, borderColor: COLORS.border, borderWidth: 1 });
    let cursorX = MARGIN;
    columns.forEach((column, index) => {
      page.drawText(column.label, { x: cursorX + 5, y: y - 14, size: 8.4, font: bold, color: COLORS.brand });
      cursorX += columnWidths[index];
    });

    let currentY = y - headerHeight;
    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      page.drawRectangle({ x: MARGIN, y: currentY - rowHeight, width: tableWidth, height: rowHeight, color: rowIndex % 2 === 0 ? COLORS.white : COLORS.slateSoft, borderColor: COLORS.border, borderWidth: 1 });
      let currentX = MARGIN;
      row.forEach((cell, i) => {
        const lines = wrapText(String(cell), regular, fontSize, columnWidths[i] - 10);
        let textY = currentY - rowPadding - fontSize;
        for (const line of lines) {
          page.drawText(line, { x: currentX + 5, y: textY, size: fontSize, font: regular, color: COLORS.ink });
          textY -= lineHeight;
        }
        currentX += columnWidths[i];
      });
      currentY -= rowHeight;
    });
    y = currentY - 10;
  }

  function drawBarChart({ title, subtitle, labels, values, height = 145, color = COLORS.brand, fill = COLORS.brandSoft, formatValue = (v) => String(v) }) {
    ensureSpace(height + 58);
    page.drawRectangle({ x: MARGIN, y: y - height - 26, width: CONTENT_WIDTH, height: height + 26, color: COLORS.white, borderColor: COLORS.border, borderWidth: 1 });
    page.drawText(title, { x: MARGIN + 12, y: y - 15, size: 10.8, font: bold, color: COLORS.brand });
    if (subtitle) page.drawText(subtitle, { x: MARGIN + 12, y: y - 28, size: 8.2, font: regular, color: COLORS.muted });

    const chartTop = y - 40;
    const chartBottom = y - height - 6;
    const chartHeight = chartTop - chartBottom;
    const maxValue = Math.max(...values) * 1.1;
    const gap = 4;
    const barWidth = (CONTENT_WIDTH - 24 - gap * (values.length - 1)) / values.length;
    page.drawLine({ start: { x: MARGIN + 12, y: chartBottom }, end: { x: MARGIN + CONTENT_WIDTH - 12, y: chartBottom }, thickness: 1, color: COLORS.border });

    values.forEach((value, index) => {
      const barHeight = (value / maxValue) * (chartHeight - 18);
      const x = MARGIN + 12 + index * (barWidth + gap);
      page.drawRectangle({ x, y: chartBottom, width: barWidth, height: barHeight, color: fill });
      page.drawRectangle({ x, y: chartBottom, width: barWidth, height: barHeight, borderColor: color, borderWidth: 1 });
      page.drawText(labels[index], { x: x + 1, y: chartBottom - 11, size: 6.2, font: regular, color: COLORS.muted });
      page.drawText(formatValue(value), { x: x + 1, y: chartBottom + barHeight + 3, size: 6.2, font: regular, color: COLORS.ink });
    });

    y -= height + 38;
  }

  function drawDualLineChart({ title, subtitle, labels, seriesA, seriesB, labelA, labelB, colorA = COLORS.green, colorB = COLORS.red, formatValue = (v) => String(v), height = 170 }) {
    ensureSpace(height + 66);
    page.drawRectangle({ x: MARGIN, y: y - height - 28, width: CONTENT_WIDTH, height: height + 28, color: COLORS.white, borderColor: COLORS.border, borderWidth: 1 });
    page.drawText(title, { x: MARGIN + 12, y: y - 15, size: 10.8, font: bold, color: COLORS.brand });
    if (subtitle) page.drawText(subtitle, { x: MARGIN + 12, y: y - 28, size: 8.2, font: regular, color: COLORS.muted });

    const left = MARGIN + 24;
    const right = MARGIN + CONTENT_WIDTH - 14;
    const top = y - 42;
    const bottom = y - height - 6;
    const chartHeight = top - bottom;
    const maxValue = Math.max(...seriesA, ...seriesB) * 1.1;
    const stepX = (right - left) / (labels.length - 1);

    for (let i = 0; i <= 4; i += 1) {
      const guideValue = (maxValue / 4) * i;
      const guideY = bottom + (guideValue / maxValue) * chartHeight;
      page.drawLine({ start: { x: left, y: guideY }, end: { x: right, y: guideY }, thickness: 1, color: COLORS.border });
      page.drawText(formatValue(Math.round(guideValue)), { x: MARGIN + 4, y: guideY - 3, size: 6.2, font: regular, color: COLORS.muted });
    }

    const drawSeries = (series, color) => {
      series.forEach((value, index) => {
        const px = left + stepX * index;
        const py = bottom + (value / maxValue) * chartHeight;
        if (index > 0) {
          const prevX = left + stepX * (index - 1);
          const prevY = bottom + (series[index - 1] / maxValue) * chartHeight;
          page.drawLine({ start: { x: prevX, y: prevY }, end: { x: px, y: py }, thickness: 2, color });
        }
        page.drawCircle({ x: px, y: py, size: 2.2, color, borderColor: color, borderWidth: 1 });
      });
    };

    drawSeries(seriesA, colorA);
    drawSeries(seriesB, colorB);

    labels.forEach((label, index) => {
      page.drawText(label, { x: left + stepX * index - 5, y: bottom - 11, size: 6.2, font: regular, color: COLORS.muted });
    });
    page.drawText(labelA, { x: MARGIN + 12, y: bottom - 25, size: 8, font: bold, color: colorA });
    page.drawText(labelB, { x: MARGIN + 74, y: bottom - 25, size: 8, font: bold, color: colorB });

    y -= height + 42;
  }

  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: COLORS.white });
  page.drawRectangle({ x: 0, y: PAGE.height - 190, width: PAGE.width, height: 190, color: COLORS.brandSoft });
  page.drawText("Strehe-Prona", { x: MARGIN, y: PAGE.height - 92, size: 26, font: bold, color: COLORS.brand });
  page.drawText("Diaspora Apartment Oversight Business Plan", { x: MARGIN, y: PAGE.height - 122, size: 15, font: regular, color: COLORS.ink });
  drawTextBlock(
    "A focused property oversight service for diaspora apartment owners in Prishtina and nearby, built around recurring checks, arrival preparation, utility handling, and renovation supervision.",
    MARGIN,
    PAGE.height - 152,
    { size: 10.3, color: COLORS.muted, maxWidth: 390, lineHeight: 13.2 },
  );

  y = PAGE.height - 238;
  drawCardRow([
    { label: "Core Niche", value: "Diaspora owners", note: "Apartments only at launch. Prishtina + nearby, especially Fushe Kosove." },
    { label: "Year-3 Base Aim", value: "180-250 clients", note: "Enough to build a serious niche business without pretending the market is infinite.", tone: "green" },
    { label: "Why It Wins", value: "Trust + visibility", note: "This is local representation and prevention, not generic cleaning.", tone: "amber" },
  ]);

  drawSectionTitle("What Strehe-Prona Really Is", "The business is not a generic maintenance company and not a software startup.");
  drawBulletList([
    "Strehe-Prona solves the coordination, trust, and visibility gap for diaspora apartment owners who are not present day to day.",
    "The software is an internal operating system for tasks, keys, reporting, contracts, and billing. It is not the product sold to the market.",
    "The product is peace of mind: one trusted local operator who checks the apartment, documents it, prepares it before arrival, and coordinates action when needed.",
  ]);

  drawSectionTitle("Problem Statement", "Diaspora owners often have property in Kosovo but no structured local operating partner.");
  drawBulletList([
    "They cannot inspect the apartment regularly or react quickly when small issues appear.",
    "They often rely on relatives, neighbors, or ad hoc favors that do not scale and are hard to standardize.",
    "There is usually no formal reporting, no fixed checklist, and no consistent control over keys, access, and contractor coordination.",
    "Before arriving in Kosovo, the apartment may not be ready, and during repair or renovation work they often lack one accountable local point of contact.",
  ]);

  drawSectionTitle("Service Architecture", "Recurring packages create the base, while add-ons lift revenue per customer and deepen trust.");
  drawSimpleTable(
    [
      { label: "Package", width: 90 },
      { label: "Price", width: 92 },
      { label: "What The Client Gets", width: 325 },
    ],
    packageRows,
    { fontSize: 8.3, lineHeight: 10.5 },
  );

  newPage();
  drawSectionTitle("Add-On Services", "These services map directly to diaspora-owner pain points.");
  drawSimpleTable(
    [
      { label: "Add-On", width: 145 },
      { label: "Price", width: 95 },
      { label: "Use Case", width: 267 },
    ],
    addOnRows,
    { fontSize: 8.3, lineHeight: 10.5 },
  );

  drawSectionTitle("Visit Standard", "Every visit must feel structured and repeatable.");
  drawBulletList([
    "Photo of entrance, bathroom, kitchen, windows, and key utilities or meters where relevant.",
    "Short video plus a simple conclusion: condition OK, issue found, or action needed.",
    "Timestamped visit with one fixed checklist so the service feels professional instead of improvised.",
  ]);

  drawSectionTitle("Target Customer", "The year-1 customer is narrow by design.");
  drawBulletList([
    "Primary customer: diaspora apartment owners in Prishtina and nearby areas.",
    "The launch focus is apartments only. Houses introduce new operational complexity and should come later.",
    "Agencies are not a main launch segment unless they specifically manage diaspora-owner units in the target radius.",
    "A later adjacent offer may be created for local owners who travel for long periods and need extra visit frequency.",
  ]);

  drawSectionTitle("Value Proposition", "The offer is not labor by the hour. The offer is local oversight.");
  drawParagraph(
    "Strehe-Prona gives diaspora owners one trusted operator who keeps the apartment checked, documented, ready when needed, and under control. The value lies in oversight, prevention, visibility, coordination, and peace of mind, not just in cleaning or maintenance tasks by themselves.",
    { size: 9.4, lineHeight: 12.7 },
  );

  drawSectionTitle("Market Context", "The plan uses verified public signals plus clearly labelled founder inference.");
  drawSimpleTable(
    [
      { label: "Market Point", width: 180 },
      { label: "Meaning", width: 327 },
    ],
    marketRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  newPage();
  drawSectionTitle("Serviceable Market Scenarios", "Because exact diaspora apartment ownership share is not verified, the cleanest method is scenario modeling.");
  drawSimpleTable(
    [
      { label: "Scenario", width: 230 },
      { label: "Serviceable Apartments", width: 130 },
      { label: "2% Capture by Year 3", width: 147 },
    ],
    scenarioRows,
    { fontSize: 8.6, lineHeight: 11 },
  );

  drawCardRow([
    { label: "Pragmatic View", value: "232 clients", note: "Already a meaningful business at 2% of a narrow 10% serviceable market.", tone: "green" },
    { label: "Likely Base Case", value: "180-250", note: "More credible for planning than claiming the biggest scenario too early." },
    { label: "Scaling Warning", value: "465+ gets heavy", note: "Would require a field team, routing discipline, and stronger management layers.", tone: "amber" },
  ]);

  drawBarChart({
    title: "Year-3 Market Scenarios",
    subtitle: "How many active clients 2% capture could mean under different niche assumptions.",
    labels: ["10%", "20%", "30%", "50%"],
    values: year3Clients,
    color: COLORS.brand,
    fill: COLORS.brandSoft,
    formatValue: (v) => `${v}`,
  });

  drawSectionTitle("Acquisition Plan", "This category will not be won by broad ads. It will be won by trust.");
  drawSimpleTable(
    [
      { label: "Phase", width: 82 },
      { label: "Channel", width: 120 },
      { label: "Actions", width: 225 },
      { label: "Target Outcome", width: 80 },
    ],
    acquisitionRows,
    { fontSize: 7.9, lineHeight: 10.1 },
  );

  drawSectionTitle("Brand Direction", "The brand should feel premium-trustworthy, calm, and local rather than flashy.");
  drawParagraph(
    "Diaspora owners are not mainly buying convenience. They are buying confidence that someone serious is looking after their apartment. The brand therefore needs to communicate discretion, organization, visible standards, and secure handling of access and reporting.",
    { size: 9.4, lineHeight: 12.7 },
  );

  newPage();
  drawSectionTitle("12-Month Base-Case Ramp", "This is an operating model, not a promise. It shows how the business can grow without fantasy assumptions.");
  drawSimpleTable(
    [
      { label: "Month", width: 36 },
      { label: "Clients", width: 42 },
      { label: "Package Rev.", width: 84 },
      { label: "Add-On Rev.", width: 76 },
      { label: "Total Rev.", width: 72 },
      { label: "Costs", width: 72 },
      { label: "Net", width: 60 },
      { label: "Cash End", width: 65 },
    ],
    months.map((month, i) => [month, customers[i], euro(recurringRevenue[i]), euro(addonsRevenue[i]), euro(totalRevenue[i]), euro(operatingExpenses[i]), euro(monthlyNet[i]), euro(endingCash[i])]),
    { fontSize: 7.2, lineHeight: 9.3 },
  );

  drawCardRow([
    { label: "Break-Even Month", value: "M7", note: "Base case monthly revenue begins to overtake monthly operating cost.", tone: "green" },
    { label: "Lowest Cash Point", value: euro(Math.min(...endingCash)), note: "Shows why the working-capital reserve matters.", tone: "red" },
    { label: "Year-End Cash", value: euro(endingCash[endingCash.length - 1]), note: "Only if the acquisition and add-on path actually gets executed." },
  ]);

  drawDualLineChart({
    title: "Revenue vs Operating Costs",
    subtitle: "Base-case 12-month ramp.",
    labels: months,
    seriesA: totalRevenue,
    seriesB: operatingExpenses,
    labelA: "Revenue",
    labelB: "Costs",
    formatValue: (v) => `${Math.round(v / 1000)}k`,
  });

  newPage();
  drawSectionTitle("Customer and Revenue Growth", "The business becomes interesting when recurring packages and add-ons reinforce each other.");
  drawBarChart({
    title: "Planned Customer Growth",
    subtitle: "Founders-led trust growth rather than mass-market acquisition.",
    labels: months,
    values: customers,
    color: COLORS.green,
    fill: COLORS.greenSoft,
    formatValue: (v) => `${v}`,
  });

  drawBarChart({
    title: "Blended Monthly Revenue",
    subtitle: "Package revenue plus add-on revenue from arrival prep, utility handling, and oversight.",
    labels: months,
    values: totalRevenue,
    color: COLORS.brand,
    fill: COLORS.brandSoft,
    formatValue: (v) => `${Math.round(v / 1000)}k`,
  });

  drawSectionTitle("Year-3 Operating Weight", "2% of even a narrow serviceable niche already creates a real field operation.");
  drawSimpleTable(
    [
      { label: "Year-3 Scenario", width: 150 },
      { label: "Clients", width: 80 },
      { label: "Approx. Monthly Revenue", width: 140 },
      { label: "Approx. Monthly Visits", width: 137 },
    ],
    [
      ["2% of 10% niche", year3Clients[0], euro(year3Revenue[0]), year3Visits[0]],
      ["2% of 20% niche", year3Clients[1], euro(year3Revenue[1]), year3Visits[1]],
      ["2% of 30% niche", year3Clients[2], euro(year3Revenue[2]), year3Visits[2]],
      ["2% of 50% niche", year3Clients[3], euro(year3Revenue[3]), year3Visits[3]],
    ],
    { fontSize: 8.3, lineHeight: 10.6 },
  );

  drawParagraph(
    "The most realistic strategic interpretation is that Strehe-Prona should not plan around the biggest scenario first. A year-3 base case of roughly 180 to 250 active clients is already enough to become a substantial niche business and is more credible than claiming fast capture of a much larger share.",
    { size: 9.4, lineHeight: 12.7 },
  );

  drawSectionTitle("Staffing Thresholds", "This is where the plan turns into an operating tool rather than just a market story.");
  drawSimpleTable(
    [
      { label: "Client Load", width: 120 },
      { label: "Recommended Team Shape", width: 185 },
      { label: "Meaning", width: 206 },
    ],
    staffingRows,
    { fontSize: 7.9, lineHeight: 10.1 },
  );

  drawSectionTitle("Three-Year Financial Model", "Planning ranges are more useful than pretending to know the exact future.");
  drawSimpleTable(
    [
      { label: "Scenario", width: 95 },
      { label: "Client Path", width: 170 },
      { label: "Interpretation", width: 246 },
    ],
    financialModelRows,
    { fontSize: 8, lineHeight: 10.2 },
  );

  newPage();
  drawSectionTitle("Startup Cash Need", "The startup does not need a luxury fit-out. It needs a clean base, secure storage, and enough runway to build trust.");
  drawSimpleTable(
    [
      { label: "Use of Funds", width: 330 },
      { label: "Amount", width: 90 },
      { label: "Role", width: 87 },
    ],
    startupBudget.map(([label, amount]) => [label, euro(amount), amount >= 1000 ? "Core need" : "Support"]),
    { fontSize: 8.3, lineHeight: 10.5 },
  );

  drawParagraph(
    "The space should be representative but not oversized in ambition. The right move is a small polished front corner, a compact admin desk zone, a secure key and document area, and a functional storage/prep zone. This supports a premium-trustworthy feeling without wasting capital on a large office fit-out.",
    { size: 9.4, lineHeight: 12.7 },
  );

  drawSectionTitle("Team and Organization", "The team should look lean, real, and operationally credible rather than inflated.");
  drawSimpleTable(
    [
      { label: "Role", width: 170 },
      { label: "Main Responsibility", width: 337 },
    ],
    teamRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawSimpleTable(
    [
      { label: "Stage", width: 150 },
      { label: "How The Team Evolves", width: 357 },
    ],
    growthTeamRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawSectionTitle("Year-3 Revenue Illustration", "At this point the document stops being theoretical and becomes a planning tool.");
  drawSimpleTable(
    [
      { label: "Scenario", width: 100 },
      { label: "Clients", width: 70 },
      { label: "Monthly Revenue", width: 120 },
      { label: "Annual Revenue", width: 120 },
    ],
    year3EconomicsRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawSectionTitle("SWOT", "A proper plan needs realism, not only excitement.");
  drawSimpleTable(
    [
      { label: "Factor", width: 110 },
      { label: "What It Means", width: 397 },
    ],
    swotRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawSectionTitle("Strategic Routes", "Growth can follow different paths, and not all of them fit the brand.");
  drawSimpleTable(
    [
      { label: "Route", width: 150 },
      { label: "What It Looks Like", width: 220 },
      { label: "Interpretation", width: 137 },
    ],
    routeRows,
    { fontSize: 8.1, lineHeight: 10.2 },
  );

  drawSectionTitle("Surprise Reduction Triggers", "The business should not wait for chaos before reacting.");
  drawSimpleTable(
    [
      { label: "Warning Sign", width: 210 },
      { label: "Required Response", width: 297 },
    ],
    triggerRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawBulletList([
    "The strongest strategic advantage is category clarity: trusted apartment oversight for diaspora owners.",
    "The biggest early challenge is trust proof. Reports, testimonials, process discipline, and visible key-security standards matter more than loud branding.",
    "The real scaling inflection point is not just more customers. It is the moment when visit density and field complexity force a team beyond the founders.",
  ], { size: 9.4, lineHeight: 12.6 });

  drawSectionTitle("Conclusion", "The business is stronger when described as a narrow category leader rather than a broad service provider.");
  drawParagraph(
    "Strehe-Prona is best understood as a trusted local apartment oversight service for diaspora owners in Prishtina and nearby areas. It wins by combining recurring care packages, strong reporting discipline, secure key handling, useful add-ons, and software-backed internal control. If executed well, it can own a clear and defensible niche instead of competing as a generic low-cost property service.",
    { size: 9.4, lineHeight: 12.7 },
  );

  drawSectionTitle("Sources Used", "Market sections rely on public data plus clearly stated founder inference where exact proof is not available.");
  drawBulletList(sources, { size: 8.8, lineHeight: 11.8 });

  newPage();
  drawSectionTitle("KPI Dashboard", "The business should be managed from a small number of recurring metrics reviewed every month.");
  drawSimpleTable(
    [
      { label: "KPI Group", width: 120 },
      { label: "What Should Be Tracked", width: 387 },
    ],
    kpiRows,
    { fontSize: 8.2, lineHeight: 10.3 },
  );

  drawSectionTitle("Service SOP Appendix", "The company should not depend on memory. It should depend on repeatable procedures.");
  drawSimpleTable(
    [
      { label: "SOP", width: 150 },
      { label: "Core Steps", width: 357 },
    ],
    sopRows,
    { fontSize: 8.1, lineHeight: 10.2 },
  );

  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Strehe-Prona | Diaspora Business Plan | Page ${index + 1}`, {
      x: MARGIN,
      y: 20,
      size: 8,
      font: regular,
      color: COLORS.muted,
    });
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, await pdf.save());
  console.log(`Generated PDF: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
