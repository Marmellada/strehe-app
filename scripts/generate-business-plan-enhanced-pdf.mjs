import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(
  rootDir,
  "docs",
  "business-plan",
  "Strehe-Prona-Business-Plan-Enhanced.pdf",
);

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 44;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const COLORS = {
  ink: rgb(0.11, 0.12, 0.16),
  muted: rgb(0.44, 0.48, 0.54),
  border: rgb(0.83, 0.86, 0.9),
  brand: rgb(0.11, 0.34, 0.56),
  brandSoft: rgb(0.9, 0.95, 1),
  green: rgb(0.13, 0.5, 0.34),
  greenSoft: rgb(0.91, 0.97, 0.94),
  amber: rgb(0.72, 0.47, 0.08),
  amberSoft: rgb(1, 0.97, 0.89),
  red: rgb(0.68, 0.2, 0.18),
  redSoft: rgb(0.99, 0.93, 0.92),
  slateSoft: rgb(0.96, 0.97, 0.98),
  white: rgb(1, 1, 1),
};

const months = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
const customers = [4, 7, 10, 14, 18, 22, 26, 30, 34, 37, 40, 44];
const recurringRevenue = [180, 315, 450, 630, 810, 990, 1170, 1350, 1530, 1665, 1800, 1980];
const projectMarginRevenue = [60, 100, 150, 220, 300, 380, 480, 600, 720, 850, 980, 1100];
const totalRevenue = recurringRevenue.map((value, index) => value + projectMarginRevenue[index]);
const operatingExpenses = [1310, 1310, 1330, 1360, 1400, 1450, 1490, 1540, 1590, 1640, 1690, 1750];
const monthlyNetCash = totalRevenue.map((value, index) => value - operatingExpenses[index]);
const openingReserve = 4500;
const endingCash = monthlyNetCash.reduce((acc, value) => {
  const last = acc[acc.length - 1] ?? openingReserve;
  acc.push(last + value);
  return acc;
}, []);

const startupBudget = [
  ["Company registration and setup", 300],
  ["Premises preparation and cleaning", 350],
  ["Office setup", 900],
  ["Shelving and storage", 700],
  ["Business PC / workstation", 1000],
  ["Starter tools and consumables", 1000],
  ["Workwear / PPE", 250],
  ["Document safe", 250],
  ["Key safe / key cabinet", 350],
  ["Website and branding", 500],
  ["Launch marketing", 500],
  ["Transport buffer", 400],
  ["Contractor float", 1000],
  ["Working capital reserve", 4500],
];

const acquisitionRows = [
  ["Months 1-2", "Founder outreach", "Call and visit landlords, property owners, and referrals from family network", "4-7 active customers"],
  ["Months 1-3", "Social media launch", "Short videos, before/after content, trust-focused local pages, WhatsApp and Instagram contact flow", "Lead pipeline for first recurring clients"],
  ["Months 2-4", "Referral engine", "Ask each happy client for 1 referral and offer simple service credit / discount", "Low-cost acquisition"],
  ["Months 3-6", "Agency partnerships", "Approach rental agencies and small property managers as execution partner", "Steadier job flow and handovers"],
  ["Months 4-8", "Review and proof system", "Collect testimonials, photo reports, service snapshots, and recurring package examples", "Higher conversion rate"],
  ["Months 6-12", "Cluster sales", "Sell service packages to owners with multiple units or multiple addresses", "Faster customer growth with same team"],
];

function euro(value) {
  return `EUR ${value.toLocaleString("en-GB")}`;
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
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
    const {
      font = regular,
      size = 10.5,
      color = COLORS.ink,
      maxWidth = CONTENT_WIDTH,
      lineHeight = size + 3.5,
    } = options;

    const lines = wrapText(text, font, size, maxWidth);
    let currentY = topY;

    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size, font, color });
      currentY -= lineHeight;
    }

    return currentY;
  }

  function drawSectionTitle(title, subtitle) {
    ensureSpace(52);
    page.drawText(title, {
      x: MARGIN,
      y,
      size: 16,
      font: bold,
      color: COLORS.brand,
    });
    y -= 18;
    if (subtitle) {
      y = drawTextBlock(subtitle, MARGIN, y, {
        size: 10,
        color: COLORS.muted,
        lineHeight: 13,
      });
    }
    y -= 8;
  }

  function drawParagraph(text, options = {}) {
    const size = options.size ?? 10.5;
    const lineHeight = options.lineHeight ?? size + 3.5;
    const spacing = options.spacing ?? 8;
    const needed = wrapText(text, options.font ?? regular, size, options.maxWidth ?? CONTENT_WIDTH).length * lineHeight + spacing;
    ensureSpace(needed);
    y = drawTextBlock(text, options.x ?? MARGIN, y, {
      font: options.font ?? regular,
      size,
      color: options.color ?? COLORS.ink,
      maxWidth: options.maxWidth ?? CONTENT_WIDTH,
      lineHeight,
    });
    y -= spacing;
  }

  function drawBulletList(items, options = {}) {
    const bulletX = options.x ?? MARGIN;
    const textX = bulletX + 12;
    const maxWidth = (options.maxWidth ?? CONTENT_WIDTH) - 12;

    for (const item of items) {
      const size = options.size ?? 10.5;
      const lineHeight = options.lineHeight ?? size + 3.5;
      const lines = wrapText(item, regular, size, maxWidth);
      ensureSpace(lines.length * lineHeight + 4);
      page.drawText("-", { x: bulletX, y, size, font: bold, color: COLORS.brand });
      y = drawTextBlock(item, textX, y, {
        font: regular,
        size,
        color: COLORS.ink,
        maxWidth,
        lineHeight,
      });
      y -= 4;
    }
  }

  function drawCardRow(cards) {
    const gap = 12;
    const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
    const height = 86;
    ensureSpace(height + 10);

    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      const tone = card.tone || "brand";
      const fill =
        tone === "green" ? COLORS.greenSoft :
        tone === "amber" ? COLORS.amberSoft :
        tone === "red" ? COLORS.redSoft :
        COLORS.brandSoft;
      const ink =
        tone === "green" ? COLORS.green :
        tone === "amber" ? COLORS.amber :
        tone === "red" ? COLORS.red :
        COLORS.brand;

      page.drawRectangle({
        x,
        y: y - height + 6,
        width,
        height,
        color: fill,
        borderColor: COLORS.border,
        borderWidth: 1,
      });
      page.drawText(card.label, {
        x: x + 12,
        y: y - 16,
        size: 9,
        font: bold,
        color: ink,
      });
      page.drawText(card.value, {
        x: x + 12,
        y: y - 40,
        size: 19,
        font: bold,
        color: COLORS.ink,
      });
      if (card.note) {
        drawTextBlock(card.note, x + 12, y - 57, {
          size: 8.5,
          color: COLORS.muted,
          maxWidth: width - 24,
          lineHeight: 11,
        });
      }
    });

    y -= height + 12;
  }

  function drawSimpleTable(columns, rows, options = {}) {
    const topPadding = 8;
    const rowPadding = 6;
    const headerHeight = 24;
    const columnWidths = columns.map((column) => column.width);
    const fontSize = options.fontSize ?? 9;
    const lineHeight = options.lineHeight ?? 12;
    const tableWidth = columnWidths.reduce((sum, value) => sum + value, 0);

    const rowHeights = rows.map((row) => {
      const heights = row.map((cell, index) => {
        const text = String(cell);
        const lines = wrapText(text, regular, fontSize, columnWidths[index] - 10);
        return lines.length * lineHeight + rowPadding * 2;
      });
      return Math.max(...heights, 22);
    });

    const totalHeight = headerHeight + topPadding + rowHeights.reduce((sum, value) => sum + value, 0);
    ensureSpace(totalHeight + 10);

    let cursorX = MARGIN;
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: COLORS.slateSoft,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    columns.forEach((column, index) => {
      page.drawText(column.label, {
        x: cursorX + 5,
        y: y - 15,
        size: 8.5,
        font: bold,
        color: COLORS.brand,
      });
      cursorX += columnWidths[index];
    });

    let currentY = y - headerHeight;
    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      page.drawRectangle({
        x: MARGIN,
        y: currentY - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? COLORS.white : COLORS.slateSoft,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      let currentX = MARGIN;
      row.forEach((cell, cellIndex) => {
        const text = String(cell);
        const lines = wrapText(text, regular, fontSize, columnWidths[cellIndex] - 10);
        let textY = currentY - rowPadding - fontSize;
        for (const line of lines) {
          page.drawText(line, {
            x: currentX + 5,
            y: textY,
            size: fontSize,
            font: regular,
            color: COLORS.ink,
          });
          textY -= lineHeight;
        }
        currentX += columnWidths[cellIndex];
      });

      currentY -= rowHeight;
    });

    y = currentY - 10;
  }

  function drawBarChart(config) {
    const {
      title,
      subtitle,
      labels,
      values,
      x = MARGIN,
      width = CONTENT_WIDTH,
      height = 150,
      color = COLORS.brand,
      fill = COLORS.brandSoft,
      formatValue = (value) => String(value),
    } = config;

    ensureSpace(height + 60);

    page.drawRectangle({
      x,
      y: y - height - 28,
      width,
      height: height + 28,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText(title, { x: x + 12, y: y - 16, size: 11, font: bold, color: COLORS.brand });
    if (subtitle) {
      page.drawText(subtitle, { x: x + 12, y: y - 29, size: 8.5, font: regular, color: COLORS.muted });
    }

    const chartTop = y - 42;
    const chartBottom = y - height - 8;
    const chartHeight = chartTop - chartBottom;
    const maxValue = Math.max(...values) * 1.1;
    const gap = 4;
    const barWidth = (width - 24 - gap * (values.length - 1)) / values.length;

    page.drawLine({
      start: { x: x + 12, y: chartBottom },
      end: { x: x + width - 12, y: chartBottom },
      thickness: 1,
      color: COLORS.border,
    });

    values.forEach((value, index) => {
      const barHeight = (value / maxValue) * (chartHeight - 20);
      const barX = x + 12 + index * (barWidth + gap);
      const barY = chartBottom;
      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        color: fill,
      });
      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        borderColor: color,
        borderWidth: 1,
      });
      page.drawText(labels[index], {
        x: barX + 2,
        y: chartBottom - 12,
        size: 6.5,
        font: regular,
        color: COLORS.muted,
      });
      page.drawText(formatValue(value), {
        x: barX + 1,
        y: barY + barHeight + 4,
        size: 6.5,
        font: regular,
        color: COLORS.ink,
      });
    });

    y -= height + 42;
  }

  function drawDualLineChart(config) {
    const {
      title,
      subtitle,
      labels,
      seriesA,
      seriesB,
      labelA,
      labelB,
      x = MARGIN,
      width = CONTENT_WIDTH,
      height = 170,
      colorA = COLORS.green,
      colorB = COLORS.red,
      formatValue = (value) => String(value),
    } = config;

    ensureSpace(height + 70);

    page.drawRectangle({
      x,
      y: y - height - 32,
      width,
      height: height + 32,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText(title, { x: x + 12, y: y - 16, size: 11, font: bold, color: COLORS.brand });
    if (subtitle) {
      page.drawText(subtitle, { x: x + 12, y: y - 29, size: 8.5, font: regular, color: COLORS.muted });
    }

    const chartLeft = x + 24;
    const chartRight = x + width - 16;
    const chartTop = y - 44;
    const chartBottom = y - height - 6;
    const chartHeight = chartTop - chartBottom;
    const maxValue = Math.max(...seriesA, ...seriesB) * 1.1;
    const stepX = (chartRight - chartLeft) / (labels.length - 1);

    for (let i = 0; i < 4; i += 1) {
      const guideValue = (maxValue / 4) * i;
      const guideY = chartBottom + (guideValue / maxValue) * chartHeight;
      page.drawLine({
        start: { x: chartLeft, y: guideY },
        end: { x: chartRight, y: guideY },
        thickness: 1,
        color: COLORS.border,
      });
      page.drawText(formatValue(Math.round(guideValue)), {
        x: x + 4,
        y: guideY - 3,
        size: 6.5,
        font: regular,
        color: COLORS.muted,
      });
    }

    const drawSeries = (series, color) => {
      series.forEach((value, index) => {
        const pointX = chartLeft + stepX * index;
        const pointY = chartBottom + (value / maxValue) * chartHeight;
        if (index > 0) {
          const prevX = chartLeft + stepX * (index - 1);
          const prevY = chartBottom + (series[index - 1] / maxValue) * chartHeight;
          page.drawLine({
            start: { x: prevX, y: prevY },
            end: { x: pointX, y: pointY },
            thickness: 2,
            color,
          });
        }
        page.drawCircle({
          x: pointX,
          y: pointY,
          size: 2.2,
          color,
          borderColor: color,
          borderWidth: 1,
        });
      });
    };

    drawSeries(seriesA, colorA);
    drawSeries(seriesB, colorB);

    labels.forEach((label, index) => {
      page.drawText(label, {
        x: chartLeft + stepX * index - 5,
        y: chartBottom - 12,
        size: 6.5,
        font: regular,
        color: COLORS.muted,
      });
    });

    page.drawText(labelA, { x: x + 12, y: chartBottom - 28, size: 8, font: bold, color: colorA });
    page.drawText(labelB, { x: x + 80, y: chartBottom - 28, size: 8, font: bold, color: colorB });

    y -= height + 46;
  }

  function drawCashBridge() {
    const x = MARGIN;
    const width = CONTENT_WIDTH;
    const height = 120;
    ensureSpace(height + 40);

    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });
    page.drawText("Cash Need Bridge", {
      x: x + 12,
      y: y - 16,
      size: 11,
      font: bold,
      color: COLORS.brand,
    });
    page.drawText("Shows why a EUR 12,000 launch facility is reasonable for the first 6 months.", {
      x: x + 12,
      y: y - 29,
      size: 8.5,
      font: regular,
      color: COLORS.muted,
    });

    const items = [
      { label: "Loan ask", value: 12000, color: COLORS.brand },
      { label: "Setup spend", value: -7500, color: COLORS.red },
      { label: "Opening reserve", value: 4500, color: COLORS.green },
      { label: "Lowest cash point", value: 925, color: COLORS.amber },
    ];

    const barX = x + 20;
    const barY = y - 68;
    const max = 12000;
    let cursorX = barX;
    items.forEach((item, index) => {
      const segmentWidth = (Math.abs(item.value) / max) * (width - 40);
      page.drawRectangle({
        x: cursorX,
        y: barY,
        width: segmentWidth,
        height: 18,
        color: item.color,
      });
      page.drawText(`${item.label}: ${euro(Math.abs(item.value))}`, {
        x: x + 12,
        y: y - 90 - index * 12,
        size: 8,
        font: regular,
        color: COLORS.ink,
      });
      cursorX += segmentWidth;
    });

    y -= height + 12;
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: COLORS.white,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE.height - 180,
    width: PAGE.width,
    height: 180,
    color: COLORS.brandSoft,
  });

  page.drawText("Strehe-Prona", {
    x: MARGIN,
    y: PAGE.height - 92,
    size: 26,
    font: bold,
    color: COLORS.brand,
  });
  page.drawText("Business Plan and 12-Month Launch Model", {
    x: MARGIN,
    y: PAGE.height - 122,
    size: 15,
    font: regular,
    color: COLORS.ink,
  });
  drawTextBlock(
    "Property services startup in Prishtina focused on inspections, cleaning coordination, handovers, key management, maintenance coordination, and managed repair execution.",
    MARGIN,
    PAGE.height - 154,
    { size: 10.5, color: COLORS.muted, maxWidth: 350, lineHeight: 14 },
  );

  y = PAGE.height - 232;
  drawCardRow([
    { label: "Funding Ask", value: euro(12000), note: "Lean startup facility for setup plus working capital." },
    { label: "Free Premises", value: "2 years", note: "100 m2 mixed-use base in Prishtina lowers fixed risk.", tone: "green" },
    { label: "Break-Even Path", value: "20-26 clients", note: "Model moves toward break-even during the second half of year 1.", tone: "amber" },
  ]);

  drawSectionTitle("Executive Snapshot", "The business is a service company first. The software is an internal operating advantage, not the product sold to customers.");
  drawBulletList([
    "Revenue comes from recurring service packages plus margin on contractor-managed jobs.",
    "Founders handle client coordination, light execution, reporting, and service control.",
    "Specialist work is outsourced to trusted experts, which keeps fixed payroll low.",
    "The startup already has a meaningful structural advantage through free premises and a working internal platform.",
  ]);

  drawSectionTitle("What The Loan Pays For", "The funding request is structured around essential setup only, not a heavy build-out.");
  drawSimpleTable(
    [
      { label: "Use of Funds", width: 360 },
      { label: "Amount", width: 110 },
      { label: "Type", width: 82 },
    ],
    startupBudget.map(([label, amount]) => [
      label,
      euro(amount),
      amount >= 1000 ? "Core" : "Support",
    ]),
    { fontSize: 8.5, lineHeight: 11 },
  );

  newPage();
  drawSectionTitle("Business Model", "A lean property services model designed for low fixed costs and operational control.");
  drawCardRow([
    { label: "Recurring Revenue", value: "Packages", note: "Inspection, cleaning, handover, key checks, routine support." },
    { label: "Managed Jobs", value: "10-20%", note: "Margin on outsourced repair and specialist work.", tone: "green" },
    { label: "Delivery Model", value: "Founders + contractors", note: "No heavy payroll needed at launch.", tone: "amber" },
  ]);

  drawParagraph(
    "Strehe-Prona is being positioned as a trusted operating partner for landlords and property owners. Instead of trying to do every specialist job in-house, the business will manage service delivery, customer communication, task control, and reporting while using contractor capacity only when needed.",
  );

  drawSimpleTable(
    [
      { label: "Service Area", width: 155 },
      { label: "How It Is Delivered", width: 210 },
      { label: "Revenue Logic", width: 142 },
    ],
    [
      ["Inspections", "Founder-led routine checks and reporting", "Direct recurring fee"],
      ["Cleaning coordination", "Scheduled or on-demand with outside support when needed", "Direct fee or package inclusion"],
      ["Handovers", "Founder-led process with checklists and keys", "One-off service fee"],
      ["Key management", "Secure storage, custody logging, release control", "Recurring or transaction fee"],
      ["Small repairs", "Handled directly if simple", "Direct fee"],
      ["Complex repairs", "Outsourced to specialists, managed by Strehe-Prona", "10-20% coordination margin"],
    ],
    { fontSize: 8.5, lineHeight: 11 },
  );

  drawSectionTitle("Ideal Customer Segments", "The early sales focus should go after clients with recurring pain, not low-value one-off requests.");
  drawBulletList([
    "Individual landlords with 1-5 properties who want one trusted point of contact.",
    "Owners living abroad who need property oversight and handover support.",
    "Small agencies or intermediaries who need reliable execution but do not want to build in-house operations.",
    "Owners with multiple units who create natural opportunities for recurring packages and clustered service visits.",
  ]);

  newPage();
  drawSectionTitle("Client Acquisition Plan", "The first year should lean on direct outreach, proof-building, referrals, and partnerships rather than broad expensive advertising.");
  drawSimpleTable(
    [
      { label: "Phase", width: 75 },
      { label: "Channel", width: 110 },
      { label: "Actions", width: 255 },
      { label: "Expected Result", width: 72 },
    ],
    acquisitionRows,
    { fontSize: 8, lineHeight: 10.5 },
  );

  drawSectionTitle("Acquisition Logic", "How customer growth can happen without a large marketing budget.");
  drawCardRow([
    { label: "Primary Channel", value: "Founder sales", note: "Calls, visits, direct trust-building in the local market." },
    { label: "Cheapest Growth", value: "Referrals", note: "Satisfied clients should become the core low-cost channel.", tone: "green" },
    { label: "Scale Lever", value: "Property clusters", note: "Multiple units per owner improve route density and economics.", tone: "amber" },
  ]);

  drawBarChart({
    title: "Planned Customer Growth",
    subtitle: "Illustrative base case used for the 12-month cash model.",
    labels: months,
    values: customers,
    color: COLORS.brand,
    fill: COLORS.brandSoft,
    formatValue: (value) => String(value),
  });

  drawParagraph(
    "This customer growth curve is intentionally moderate. It assumes a gradual move from founder-led direct acquisition to a more referral-driven model in the middle of the first year. The plan does not require rapid viral growth to become viable.",
    { size: 9.5, lineHeight: 13, spacing: 0 },
  );

  newPage();
  drawSectionTitle("12-Month Forecast", "Base-case monthly operating model used to justify the financing request.");
  drawSimpleTable(
    [
      { label: "Month", width: 36 },
      { label: "Clients", width: 42 },
      { label: "Recurring Revenue", width: 92 },
      { label: "Project Margin", width: 82 },
      { label: "Total Revenue", width: 78 },
      { label: "Operating Costs", width: 84 },
      { label: "Net Cash", width: 60 },
      { label: "Ending Cash", width: 61 },
    ],
    months.map((month, index) => [
      month,
      customers[index],
      euro(recurringRevenue[index]),
      euro(projectMarginRevenue[index]),
      euro(totalRevenue[index]),
      euro(operatingExpenses[index]),
      euro(monthlyNetCash[index]),
      euro(endingCash[index]),
    ]),
    { fontSize: 7.4, lineHeight: 9.5 },
  );

  drawCardRow([
    { label: "Lowest Cash Point", value: euro(Math.min(...endingCash)), note: "Occurs before the model turns positive in the second half.", tone: "red" },
    { label: "Month Revenue Overtakes Costs", value: "M7", note: "Base case crosses into positive monthly net cash." , tone: "green" },
    { label: "Year-End Cash", value: euro(endingCash[endingCash.length - 1]), note: "Assumes base-case client and revenue ramp.", tone: "brand" },
  ]);

  drawParagraph(
    "This model treats managed repair revenue as margin revenue rather than full pass-through turnover, which keeps the forecast conservative and cleaner for financing purposes. It also assumes a small increase in operating expenses over time as transport, supplies, and market activity expand.",
    { size: 9.5, lineHeight: 13, spacing: 0 },
  );

  newPage();
  drawSectionTitle("Visual Forecast", "Charts make the startup cash logic easier to understand at a glance.");
  drawDualLineChart({
    title: "Monthly Revenue vs Operating Costs",
    subtitle: "Base-case forecast. Revenue crosses cost line during the second half of year 1.",
    labels: months,
    seriesA: totalRevenue,
    seriesB: operatingExpenses,
    labelA: "Revenue",
    labelB: "Costs",
    formatValue: (value) => `${Math.round(value / 1000)}k`,
  });

  drawBarChart({
    title: "Ending Cash Balance",
    subtitle: "Calculated after setup spend, using the opening reserve left from the EUR 12,000 facility.",
    labels: months,
    values: endingCash,
    color: COLORS.green,
    fill: COLORS.greenSoft,
    formatValue: (value) => `${Math.round(value)}`,
  });

  drawCashBridge();
  drawParagraph(
    "The financing request is sized to keep the business alive through the early months when customer acquisition is still building. In this base-case plan, the cash position bottoms out around month 6, then improves as recurring contracts and managed jobs increase.",
    { size: 9.5, lineHeight: 13, spacing: 0 },
  );

  newPage();
  drawSectionTitle("Expense Structure", "The business is designed to stay light on fixed costs and use contractor capacity instead of full-time specialist payroll.");
  drawSimpleTable(
    [
      { label: "Monthly Cost", width: 280 },
      { label: "Base Level", width: 100 },
      { label: "Reason", width: 127 },
    ],
    [
      ["Internet and phone", euro(80), "Core communication"],
      ["Utilities", euro(180), "Mixed-use premises"],
      ["Fuel / local transport", euro(300), "Site visits and coordination"],
      ["Supplies and consumables", euro(150), "Cleaning and small job support"],
      ["Software and hosting", euro(100), "Internal operations stack"],
      ["Bookkeeping support", euro(100), "Administrative discipline"],
      ["Marketing and promotion", euro(250), "Lead generation and trust signals"],
      ["Miscellaneous buffer", euro(150), "Operational resilience"],
    ],
    { fontSize: 8.5, lineHeight: 11 },
  );

  drawSectionTitle("Funding Case", "Why this should be viewed as a manageable startup facility instead of a speculative large-risk loan.");
  drawBulletList([
    "The company already has free use of premises for 2 years, which materially lowers startup risk.",
    "The software platform already exists, so the financing is not paying to invent the operating system from zero.",
    "The founders are covering coordination, sales, and simple work directly.",
    "Specialist execution is outsourced, which keeps payroll and equipment needs lower than a traditional service company.",
    "The requested amount is modest relative to the setup need and expected monthly cash requirement.",
  ]);

  drawSectionTitle("Main Risks and Controls", "A strong business plan should show realism, not only optimism.");
  drawSimpleTable(
    [
      { label: "Risk", width: 180 },
      { label: "Why It Matters", width: 185 },
      { label: "Mitigation", width: 146 },
    ],
    [
      ["Slow customer growth", "Could delay break-even", "Founder-led sales, referrals, partnership outreach"],
      ["Late client payments", "Creates cash pressure", "Keep reserve, invoice quickly, require clear payment terms"],
      ["Contractor reliability", "Could affect quality", "Use vetted partners and keep backup options"],
      ["Too much one-off work", "Less predictable revenue", "Push recurring packages as the main growth base"],
    ],
    { fontSize: 8.2, lineHeight: 10.5 },
  );

  drawParagraph(
    "Overall, Strehe-Prona is being built as a disciplined, low-overhead service company with clear startup constraints and a realistic path to early customer acquisition. The loan is not intended to support an inflated structure. It is intended to bridge setup, trust-building, and the first phase of recurring revenue growth.",
    { size: 9.5, lineHeight: 13, spacing: 0 },
  );

  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Strehe-Prona | Enhanced Business Plan | Page ${index + 1}`, {
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
