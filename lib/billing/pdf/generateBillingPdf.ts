import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import {
  BillingDocumentPdfData,
  CompanyBankAccountPdfData,
  PAGE,
  PDF_COLORS,
  clientAddrress,
  companyAddress,
  drawHorizontalRule,
  drawTextBlock,
  embedLogoFromUrl,
  formatCurrency,
  formatDate,
  formatPercent,
  loadPdfAssets,
  normalizeFilename,
  propertyAddress,
  resolveBillingLabel,
  splitText,
} from "@/components/billing/pdf/shared";

type GenerateBillingPdfOptions = {
  document: BillingDocumentPdfData;
};

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  document: BillingDocumentPdfData;
  currency: string;
  cursorY: number;
  pageNumber: number;
};

const TABLE = {
  description: 222,
  qty: 42,
  unitPrice: 82,
  vat: 48,
  total: 105.28,
};

const TABLE_PADDING_X = 8;
const TABLE_HEADER_HEIGHT = 24;
const ROW_PADDING_Y = 7;
const ROW_LINE_HEIGHT = 12;

const SECTION_GAP = 20;
const SMALL_GAP = 10;

const FOOTER_RESERVED = 56;
const MIN_BOTTOM_Y = PAGE.marginBottom + FOOTER_RESERVED;

function createPage(ctx: Omit<PdfContext, "page" | "cursorY" | "pageNumber"> & {
  pageNumber: number;
}): PdfContext {
  const page = ctx.pdfDoc.addPage([PAGE.width, PAGE.height]);

  return {
    ...ctx,
    page,
    cursorY: PAGE.height - PAGE.marginTop,
  };
}

function selectAccountsForPdf(
  accounts: CompanyBankAccountPdfData[]
): CompanyBankAccountPdfData[] {
  if (!accounts?.length) return [];
  const primary = accounts.find((account) => account.is_primary);
  if (primary) return [primary];
  return accounts;
}

function tableX() {
  const leftX = PAGE.marginX;
  const xDesc = leftX;
  const xQty = xDesc + TABLE.description;
  const xUnit = xQty + TABLE.qty;
  const xVat = xUnit + TABLE.unitPrice;
  const xTotal = xVat + TABLE.vat;

  return { leftX, xDesc, xQty, xUnit, xVat, xTotal };
}

function availableContentWidth() {
  return PAGE.width - PAGE.marginX * 2;
}

function drawFooter(ctx: PdfContext): PdfContext {
  const { page, document, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const footerY = PAGE.marginBottom - 2;

  drawHorizontalRule(page, footerY + 16);

  const leftText = document.company.company_name || "";
  const rightParts = [
    document.company.vat_number ? `VAT: ${document.company.vat_number}` : "",
    document.company.business_number
      ? `Business No: ${document.company.business_number}`
      : "",
    document.company.website || "",
  ].filter(Boolean);

  const rightText = rightParts.join("   ");

  if (leftText) {
    page.drawText(leftText, {
      x: leftX,
      y: footerY,
      size: 9,
      font: fontRegular,
      color: PDF_COLORS.muted,
    });
  }

  if (rightText) {
    page.drawText(rightText, {
      x: rightX - fontRegular.widthOfTextAtSize(rightText, 9),
      y: footerY,
      size: 9,
      font: fontRegular,
      color: PDF_COLORS.muted,
    });
  }

  return ctx;
}

async function startPage(
  base: Omit<PdfContext, "page" | "cursorY" | "pageNumber">,
  pageNumber: number
): Promise<PdfContext> {
  let ctx = createPage({
    ...base,
    pageNumber,
  });

  ctx = await drawHeader(ctx);
  return ctx;
}

async function nextPage(
  ctx: PdfContext,
  options?: { withTableHeader?: boolean }
): Promise<PdfContext> {
  drawFooter(ctx);

 let nextCtx = await startPage(
  {
    pdfDoc: ctx.pdfDoc,
    fontRegular: ctx.fontRegular,
    fontBold: ctx.fontBold,
    document: ctx.document,
    currency: ctx.currency,
  },
  ctx.pageNumber + 1
);

  if (options?.withTableHeader) {
    nextCtx = drawItemsTableHeader(nextCtx, true);
  }

  return nextCtx;
}

async function ensureRoom(
  ctx: PdfContext,
  neededHeight: number,
  options?: { withTableHeader?: boolean }
): Promise<PdfContext> {
  if (ctx.cursorY - neededHeight >= MIN_BOTTOM_Y) {
    return ctx;
  }

  return nextPage(ctx, options);
}

async function drawHeader(ctx: PdfContext): Promise<PdfContext> {
  const { page, pdfDoc, document, fontBold, fontRegular, pageNumber } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;

  const topY = ctx.cursorY;
  const logo = await embedLogoFromUrl(pdfDoc, document.company.logo_url);

  let leftBlockBottomY = topY;

  if (logo) {
    const maxLogoWidth = 120;
    const maxLogoHeight = 46;
    const scaled = logo.scale(1);
    const ratio = Math.min(
      maxLogoWidth / scaled.width,
      maxLogoHeight / scaled.height,
      1
    );

    const width = scaled.width * ratio;
    const height = scaled.height * ratio;

    page.drawImage(logo, {
      x: leftX,
      y: topY - height + 4,
      width,
      height,
    });

    leftBlockBottomY = Math.min(leftBlockBottomY, topY - height - 6);
  }

  let companyY = topY;
  if (document.company.company_name) {
    page.drawText(document.company.company_name, {
      x: leftX,
      y: companyY,
      size: 11,
      font: fontBold,
      color: PDF_COLORS.text,
    });
    companyY -= 14;
  }

  const issuerLines = [
    companyAddress(document.company),
    document.company.email || "",
    document.company.phone || "",
  ].filter(Boolean);

  for (const line of issuerLines) {
    companyY =
      drawTextBlock({
        page,
        text: line,
        x: leftX,
        y: companyY,
        maxWidth: 220,
        font: fontRegular,
        fontSize: 9,
        lineHeight: 12,
        color: PDF_COLORS.muted,
      }) - 2;
  }

  leftBlockBottomY = Math.min(leftBlockBottomY, companyY);

  const title = resolveBillingLabel(document.type);
  const titleColor =
    document.type === "credit_note" ? PDF_COLORS.accent : PDF_COLORS.text;

  page.drawText(title, {
    x: rightX - fontBold.widthOfTextAtSize(title, 24),
    y: topY + 2,
    size: 24,
    font: fontBold,
    color: titleColor,
  });

  const docNumber = document.number || "Draft";
  page.drawText(docNumber, {
    x: rightX - fontBold.widthOfTextAtSize(docNumber, 12),
    y: topY - 22,
    size: 12,
    font: fontBold,
    color: PDF_COLORS.text,
  });

  const pageLabel = `Page ${pageNumber}`;
  page.drawText(pageLabel, {
    x: rightX - fontRegular.widthOfTextAtSize(pageLabel, 9),
    y: topY - 38,
    size: 9,
    font: fontRegular,
    color: PDF_COLORS.muted,
  });

  const bottomY = Math.min(leftBlockBottomY, topY - 46) - 6;

  drawHorizontalRule(page, bottomY);

  return {
    ...ctx,
    cursorY: bottomY - 18,
  };
}

function drawPartyBlocks(ctx: PdfContext): PdfContext {
  const { page, document, fontBold, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const totalWidth = rightX - leftX;
  const gap = 28;
  const colWidth = (totalWidth - gap) / 2;

  page.drawText("Issuer", {
    x: leftX,
    y: ctx.cursorY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Bill To", {
    x: leftX + colWidth + gap,
    y: ctx.cursorY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  let leftY = ctx.cursorY - 16;
  let rightY = ctx.cursorY - 16;

  leftY =
    drawTextBlock({
      page,
      text: document.company.company_name || "—",
      x: leftX,
      y: leftY,
      maxWidth: colWidth,
      font: fontBold,
      fontSize: 12,
      lineHeight: 14,
      color: PDF_COLORS.text,
    }) - 3;

  const issuerDetails = [
    companyAddress(document.company),
    document.company.email || "",
    document.company.phone || "",
    document.company.vat_number ? `VAT: ${document.company.vat_number}` : "",
    document.company.business_number
      ? `Business No: ${document.company.business_number}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  leftY =
    drawTextBlock({
      page,
      text: issuerDetails || "—",
      x: leftX,
      y: leftY,
      maxWidth: colWidth,
      font: fontRegular,
      fontSize: 10,
      lineHeight: 13,
      color: PDF_COLORS.muted,
    }) - 2;

  rightY =
    drawTextBlock({
      page,
      text:
        document.client.company_name?.trim() ||
        document.client.full_name ||
        "—",
      x: leftX + colWidth + gap,
      y: rightY,
      maxWidth: colWidth,
      font: fontBold,
      fontSize: 12,
      lineHeight: 14,
      color: PDF_COLORS.text,
    }) - 3;

  if (document.client.company_name && document.client.full_name) {
    rightY =
      drawTextBlock({
        page,
        text: document.client.full_name,
        x: leftX + colWidth + gap,
        y: rightY,
        maxWidth: colWidth,
        font: fontRegular,
        fontSize: 10,
        lineHeight: 13,
        color: PDF_COLORS.muted,
      }) - 2;
  }

  const clientDetails = [
    clientAddrress(document.client),
    document.client.email || "",
    document.client.phone || "",
    document.client.vat_number ? `VAT: ${document.client.vat_number}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  rightY =
    drawTextBlock({
      page,
      text: clientDetails || "—",
      x: leftX + colWidth + gap,
      y: rightY,
      maxWidth: colWidth,
      font: fontRegular,
      fontSize: 10,
      lineHeight: 13,
      color: PDF_COLORS.muted,
    }) - 2;

  return {
    ...ctx,
    cursorY: Math.min(leftY, rightY) - SECTION_GAP,
  };
}

function drawMetaBox(ctx: PdfContext): PdfContext {
  const { page, document, fontRegular, fontBold } = ctx;
  const leftX = PAGE.marginX;
  const boxWidth = availableContentWidth();

  const metaRows: Array<{ label: string; value: string }> = [
    {
      label: "Issue Date",
      value: formatDate(document.issue_date),
    },
    {
      label: document.type === "credit_note" ? "Credit Note No." : "Invoice No.",
      value: document.number || "Draft",
    },
  ];

  if (document.type === "invoice") {
    metaRows.push({
      label: "Due Date",
      value: formatDate(document.due_date),
    });
  }

  if (document.type === "credit_note") {
    metaRows.push({
      label: "Document Purpose",
      value:
        "This credit note reduces or reverses previously billed amounts. It is not a payment request.",
    });

    if (document.original_invoice?.number) {
      metaRows.push({
        label: "Original Invoice",
        value: `${document.original_invoice.number}${
          document.original_invoice.issue_date
            ? ` (${formatDate(document.original_invoice.issue_date)})`
            : ""
        }`,
      });
    }
  }

  if (document.property) {
    const propertyLabel =
      document.property.title || document.property.property_code || "Property";
    const propertyLine = propertyAddress(document.property);
    metaRows.push({
      label: "Property",
      value: propertyLine ? `${propertyLabel} — ${propertyLine}` : propertyLabel,
    });
  }

  const leftColX = leftX + 14;
  const rightColX = leftX + boxWidth / 2 + 10;
  const labelWidth = 96;
  const valueWidth = boxWidth / 2 - labelWidth - 28;

  let leftY = ctx.cursorY - 16;
  let rightY = ctx.cursorY - 16;

  const leftRows = metaRows.filter((_, index) => index % 2 === 0);
  const rightRows = metaRows.filter((_, index) => index % 2 === 1);

  const estimateColumnHeight = (
    rows: Array<{ label: string; value: string }>
  ): number => {
    let h = 0;
    for (const row of rows) {
      const lines = splitText(row.value || "—", fontRegular, 10, valueWidth);
      const rowLines = Math.max(1, lines.length);
      h += Math.max(20, rowLines * 13 + 6);
    }
    return h;
  };

  const estimatedHeight =
    Math.max(estimateColumnHeight(leftRows), estimateColumnHeight(rightRows)) +
    16;

  page.drawRectangle({
    x: leftX,
    y: ctx.cursorY - estimatedHeight,
    width: boxWidth,
    height: estimatedHeight,
    color:
      document.type === "credit_note" ? PDF_COLORS.noteSoft : PDF_COLORS.soft,
    borderColor: PDF_COLORS.border,
    borderWidth: 1,
  });

  for (const row of leftRows) {
    const rowTop = leftY;
    page.drawText(row.label, {
      x: leftColX,
      y: rowTop,
      size: 10,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    const valueBottomY = drawTextBlock({
      page,
      text: row.value || "—",
      x: leftColX + labelWidth,
      y: rowTop,
      maxWidth: valueWidth,
      font: fontRegular,
      fontSize: 10,
      lineHeight: 13,
      color: PDF_COLORS.text,
    });

    leftY = valueBottomY - 7;
  }

  for (const row of rightRows) {
    const rowTop = rightY;
    page.drawText(row.label, {
      x: rightColX,
      y: rowTop,
      size: 10,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    const valueBottomY = drawTextBlock({
      page,
      text: row.value || "—",
      x: rightColX + labelWidth,
      y: rowTop,
      maxWidth: valueWidth,
      font: fontRegular,
      fontSize: 10,
      lineHeight: 13,
      color: PDF_COLORS.text,
    });

    rightY = valueBottomY - 7;
  }

  return {
    ...ctx,
    cursorY: ctx.cursorY - estimatedHeight - SECTION_GAP,
  };
}

function drawItemsTableHeader(
  ctx: PdfContext,
  isContinuation = false
): PdfContext {
  const { page, fontBold } = ctx;
  const { leftX, xDesc, xQty, xUnit, xVat, xTotal } = tableX();
  const tableWidth = availableContentWidth();

  if (isContinuation) {
    page.drawText("Line Items (continued)", {
      x: leftX,
      y: ctx.cursorY,
      size: 10,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    ctx = {
      ...ctx,
      cursorY: ctx.cursorY - 14,
    };
  }

  page.drawRectangle({
    x: leftX,
    y: ctx.cursorY - TABLE_HEADER_HEIGHT,
    width: tableWidth,
    height: TABLE_HEADER_HEIGHT,
    color: PDF_COLORS.soft,
    borderColor: PDF_COLORS.border,
    borderWidth: 1,
  });

  const headerY = ctx.cursorY - 15;

  page.drawText("Description", {
    x: xDesc + TABLE_PADDING_X,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Qty", {
    x: xQty + TABLE_PADDING_X,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Unit Price", {
    x: xUnit + TABLE_PADDING_X,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("VAT", {
    x: xVat + TABLE_PADDING_X,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Line Total", {
    x: xTotal + TABLE_PADDING_X,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  return {
    ...ctx,
    cursorY: ctx.cursorY - TABLE_HEADER_HEIGHT,
  };
}

function calculateItemRowHeight(
  item: BillingDocumentPdfData["items"][number],
  fontRegular: PDFFont
): number {
  const descLines = splitText(
    item.description || "—",
    fontRegular,
    10,
    TABLE.description - TABLE_PADDING_X * 2
  );

  const valueLines = Math.max(1, descLines.length);
  return valueLines * ROW_LINE_HEIGHT + ROW_PADDING_Y * 2;
}

async function drawItemsTable(ctx: PdfContext): Promise<PdfContext> {
  let nextCtx = drawItemsTableHeader(ctx);
  const { leftX, xDesc, xQty, xUnit, xVat, xTotal } = tableX();
  const tableWidth = availableContentWidth();

  for (const item of nextCtx.document.items) {
    const rowHeight = calculateItemRowHeight(item, nextCtx.fontRegular);
    nextCtx = await ensureRoom(nextCtx, rowHeight + SMALL_GAP, {
      withTableHeader: true,
    });

    const { page, fontRegular, fontBold } = nextCtx;
    const rowTopY = nextCtx.cursorY;
    const rowBottomY = rowTopY - rowHeight;

    page.drawRectangle({
      x: leftX,
      y: rowBottomY,
      width: tableWidth,
      height: rowHeight,
      borderColor: PDF_COLORS.border,
      borderWidth: 1,
    });

    const descLines = splitText(
      item.description || "—",
      fontRegular,
      10,
      TABLE.description - TABLE_PADDING_X * 2
    );

    let descY = rowTopY - ROW_PADDING_Y - 10;
    for (const line of descLines) {
      page.drawText(line, {
        x: xDesc + TABLE_PADDING_X,
        y: descY,
        size: 10,
        font: fontRegular,
        color: PDF_COLORS.text,
      });
      descY -= ROW_LINE_HEIGHT;
    }

    const valueY = rowTopY - ROW_PADDING_Y - 10;

    page.drawText(String(item.quantity), {
      x: xQty + TABLE_PADDING_X,
      y: valueY,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(formatCurrency(item.unit_price, nextCtx.currency), {
      x: xUnit + TABLE_PADDING_X,
      y: valueY,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(formatPercent(item.vat_rate), {
      x: xVat + TABLE_PADDING_X,
      y: valueY,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    const totalText = formatCurrency(item.line_total, nextCtx.currency);
    page.drawText(totalText, {
      x:
        xTotal +
        TABLE.total -
        TABLE_PADDING_X -
        fontBold.widthOfTextAtSize(totalText, 10),
      y: valueY,
      size: 10,
      font: fontBold,
      color: PDF_COLORS.text,
    });

    nextCtx = {
      ...nextCtx,
      cursorY: rowBottomY,
    };
  }

  return {
    ...nextCtx,
    cursorY: nextCtx.cursorY - SECTION_GAP,
  };
}

function drawTotalsBox(ctx: PdfContext): PdfContext {
  const { page, fontRegular, fontBold, document, currency } = ctx;
  const rightX = PAGE.width - PAGE.marginX;

  const totalsBoxWidth = 220;
  const totalsBoxX = rightX - totalsBoxWidth;

  const rows = [
    { label: "Subtotal", value: formatCurrency(document.subtotal, currency) },
    { label: "VAT", value: formatCurrency(document.vat_total, currency) },
    {
      label: document.type === "credit_note" ? "Credit Total" : "Total Due",
      value: formatCurrency(document.total, currency),
      isTotal: true,
    },
  ];

  const rowHeight = 22;
  const totalsBoxHeight = 18 + rows.length * rowHeight + 8;

  page.drawRectangle({
    x: totalsBoxX,
    y: ctx.cursorY - totalsBoxHeight,
    width: totalsBoxWidth,
    height: totalsBoxHeight,
    color:
      document.type === "credit_note" ? PDF_COLORS.noteSoft : PDF_COLORS.soft,
    borderColor: PDF_COLORS.border,
    borderWidth: 1,
  });

  let y = ctx.cursorY - 18;

  rows.forEach((row) => {
    const size = row.isTotal ? 12 : 10;
    const labelFont = row.isTotal ? fontBold : fontRegular;
    const valueFont = row.isTotal ? fontBold : fontRegular;

    page.drawText(row.label, {
      x: totalsBoxX + 12,
      y,
      size,
      font: labelFont,
      color: row.isTotal ? PDF_COLORS.text : PDF_COLORS.muted,
    });

    page.drawText(row.value, {
      x:
        totalsBoxX +
        totalsBoxWidth -
        12 -
        valueFont.widthOfTextAtSize(row.value, size),
      y,
      size,
      font: valueFont,
      color: PDF_COLORS.text,
    });

    y -= rowHeight;
  });

  return {
    ...ctx,
    cursorY: ctx.cursorY - totalsBoxHeight - SECTION_GAP,
  };
}

function buildPaymentLines(document: BillingDocumentPdfData): string[] {
  const selectedAccounts = selectAccountsForPdf(
    document.company_bank_accounts || []
  );

  const lines: string[] = [];

  if (selectedAccounts.length > 0) {
    selectedAccounts.forEach((account, index) => {
      if (selectedAccounts.length > 1) {
        lines.push(`Account ${index + 1}`);
      }

      if (account.account_name) {
        lines.push(`Account Name: ${account.account_name}`);
      }

      if (account.bank_name) {
        lines.push(`Bank: ${account.bank_name}`);
      }

      lines.push(`IBAN: ${account.iban}`);

      if (account.swift) {
        lines.push(`SWIFT: ${account.swift}`);
      }

      if (index < selectedAccounts.length - 1) {
        lines.push("");
      }
    });
  } else {
    lines.push("Payment details available upon request.");
  }

  if (document.payment_reference) {
    lines.push("");
    lines.push(`Payment Reference: ${document.payment_reference}`);
  }

  if (document.due_date) {
    lines.push(`Due Date: ${formatDate(document.due_date)}`);
  }

  return lines;
}

function drawBottomSections(ctx: PdfContext): PdfContext {
  const { page, document, fontBold, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const contentWidth = rightX - leftX;
  const totalsBoxWidth = 220;
  const leftBlockWidth = contentWidth - totalsBoxWidth - 20;

  if (document.type === "invoice") {
    page.drawText("Payment Details", {
      x: leftX,
      y: ctx.cursorY,
      size: 11,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    let y = ctx.cursorY - 16;

    y =
      drawTextBlock({
        page,
        text: buildPaymentLines(document).join("\n"),
        x: leftX,
        y,
        maxWidth: leftBlockWidth,
        font: fontRegular,
        fontSize: 10,
        lineHeight: 14,
        color: PDF_COLORS.text,
      }) - 14;

    ctx = { ...ctx, cursorY: y };
  } else {
    page.drawText("Credit Note Reference", {
      x: leftX,
      y: ctx.cursorY,
      size: 11,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    let y = ctx.cursorY - 16;

    const message = document.original_invoice?.number
      ? `This credit note reduces the balance of invoice ${document.original_invoice.number}. It is not a request for payment.`
      : "This credit note reduces or reverses previously billed amounts. It is not a request for payment.";

    y =
      drawTextBlock({
        page,
        text: message,
        x: leftX,
        y,
        maxWidth: leftBlockWidth,
        font: fontRegular,
        fontSize: 10,
        lineHeight: 14,
        color: PDF_COLORS.text,
      }) - 14;

    ctx = { ...ctx, cursorY: y };
  }

  if (document.notes) {
    page.drawText("Notes", {
      x: leftX,
      y: ctx.cursorY,
      size: 11,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    const y =
      drawTextBlock({
        page,
        text: document.notes,
        x: leftX,
        y: ctx.cursorY - 16,
        maxWidth: contentWidth,
        font: fontRegular,
        fontSize: 10,
        lineHeight: 14,
        color: PDF_COLORS.text,
      }) - 12;

    ctx = { ...ctx, cursorY: y };
  }

  return ctx;
}

export async function generateBillingPdf({
  document,
}: GenerateBillingPdfOptions): Promise<{
  bytes: Uint8Array;
  filename: string;
}> {
  const pdfDoc = await PDFDocument.create();
  const { fontRegular, fontBold } = await loadPdfAssets(pdfDoc);

  let ctx = await startPage(
    {
      pdfDoc,
      fontRegular,
      fontBold,
      document,
      currency: document.currency || "EUR",
    },
    1
  );

  ctx = drawPartyBlocks(ctx);
  ctx = drawMetaBox(ctx);
  ctx = await drawItemsTable(ctx);

  ctx = await ensureRoom(ctx, 180);
  ctx = drawTotalsBox(ctx);
  ctx = drawBottomSections(ctx);
  drawFooter(ctx);

  const bytes = await pdfDoc.save();

  return {
    bytes,
    filename: normalizeFilename(document),
  };
}
