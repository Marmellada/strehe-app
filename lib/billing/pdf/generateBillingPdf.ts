import { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import {
  BillingDocumentPdfData,
  PAGE,
  PDF_COLORS,
  clientAddress,
  companyAddress,
  drawHorizontalRule,
  drawLabelValue,
  drawTextBlock,
  embedLogoFromUrl,
  formatCurrency,
  formatDate,
  formatPercent,
  loadPdfAssets,
  normalizeFilename,
  propertyAddress,
  resolveBillingLabel,
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
};

const TABLE = {
  description: 250,
  qty: 50,
  unitPrice: 95,
  vat: 50,
  total: 54.28,
};

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const MIN_Y_BEFORE_NEW_PAGE = 140;

function createPage(ctx: Omit<PdfContext, "page" | "cursorY">): PdfContext {
  const page = ctx.pdfDoc.addPage([PAGE.width, PAGE.height]);
  return {
    ...ctx,
    page,
    cursorY: PAGE.height - PAGE.marginTop,
  };
}

async function drawHeader(ctx: PdfContext): Promise<PdfContext> {
  const { page, pdfDoc, document, fontBold, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;

  const logo = await embedLogoFromUrl(pdfDoc, document.company.logo_url);
  let headerTopY = ctx.cursorY;

  if (logo) {
    const maxLogoWidth = 120;
    const maxLogoHeight = 52;
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
      y: headerTopY - height + 8,
      width,
      height,
    });
  }

  const label = resolveBillingLabel(document.type);
  page.drawText(label, {
    x: rightX - fontBold.widthOfTextAtSize(label, 22),
    y: headerTopY,
    size: 22,
    font: fontBold,
    color:
      document.type === "credit_note" ? PDF_COLORS.accent : PDF_COLORS.text,
  });

  headerTopY -= 22;

  const numberLabel =
    document.type === "credit_note" ? "Credit Note No." : "Invoice No.";
  const numberText = `${numberLabel}: ${document.number || "Draft"}`;

  page.drawText(numberText, {
    x: rightX - fontRegular.widthOfTextAtSize(numberText, 10),
    y: headerTopY,
    size: 10,
    font: fontRegular,
    color: PDF_COLORS.muted,
  });

  headerTopY -= 28;
  drawHorizontalRule(page, headerTopY);

  return {
    ...ctx,
    cursorY: headerTopY - 24,
  };
}

function drawPartyBlocks(ctx: PdfContext): PdfContext {
  const { page, document, fontBold, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const contentWidth = rightX - leftX;
  const gap = 28;
  const colWidth = (contentWidth - gap) / 2;

  page.drawText("From", {
    x: leftX,
    y: ctx.cursorY,
    size: 11,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Bill To", {
    x: leftX + colWidth + gap,
    y: ctx.cursorY,
    size: 11,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  let leftY = ctx.cursorY - 18;
  let rightY = ctx.cursorY - 18;

  leftY =
    drawTextBlock({
      page,
      text: document.company.company_name || "—",
      x: leftX,
      y: leftY,
      maxWidth: colWidth,
      font: fontBold,
      fontSize: 12,
    }) - 4;

  leftY =
    drawTextBlock({
      page,
      text: companyAddress(document.company) || "—",
      x: leftX,
      y: leftY,
      maxWidth: colWidth,
      font: fontRegular,
      fontSize: 10,
      color: PDF_COLORS.muted,
    }) - 3;

  if (document.company.email) {
    leftY =
      drawTextBlock({
        page,
        text: document.company.email,
        x: leftX,
        y: leftY,
        maxWidth: colWidth,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.muted,
      }) - 2;
  }

  if (document.company.phone) {
    leftY =
      drawTextBlock({
        page,
        text: document.company.phone,
        x: leftX,
        y: leftY,
        maxWidth: colWidth,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.muted,
      }) - 2;
  }

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
    }) - 4;

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
        color: PDF_COLORS.muted,
      }) - 2;
  }

  rightY =
    drawTextBlock({
      page,
      text: clientAddress(document.client) || "—",
      x: leftX + colWidth + gap,
      y: rightY,
      maxWidth: colWidth,
      font: fontRegular,
      fontSize: 10,
      color: PDF_COLORS.muted,
    }) - 3;

  if (document.client.email) {
    rightY =
      drawTextBlock({
        page,
        text: document.client.email,
        x: leftX + colWidth + gap,
        y: rightY,
        maxWidth: colWidth,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.muted,
      }) - 2;
  }

  if (document.client.vat_number) {
    rightY =
      drawTextBlock({
        page,
        text: `VAT: ${document.client.vat_number}`,
        x: leftX + colWidth + gap,
        y: rightY,
        maxWidth: colWidth,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.muted,
      }) - 2;
  }

  return {
    ...ctx,
    cursorY: Math.min(leftY, rightY) - 18,
  };
}

function drawMetaBox(ctx: PdfContext): PdfContext {
  const { page, document, fontRegular, fontBold } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const contentWidth = rightX - leftX;

  const metaBoxHeight = document.property
    ? document.type === "credit_note"
      ? 108
      : 98
    : document.type === "credit_note"
      ? 88
      : 78;

  page.drawRectangle({
    x: leftX,
    y: ctx.cursorY - metaBoxHeight,
    width: contentWidth,
    height: metaBoxHeight,
    color: PDF_COLORS.soft,
    borderColor: PDF_COLORS.border,
    borderWidth: 1,
  });

  let metaY = ctx.cursorY - 18;

  drawLabelValue({
    page,
    label: "Issue Date",
    value: formatDate(document.issue_date),
    x: leftX + 14,
    y: metaY,
    labelWidth: 70,
    valueWidth: 130,
    fontRegular,
    fontBold,
  });

  drawLabelValue({
    page,
    label: document.type === "credit_note" ? "Credit Note No." : "Invoice No.",
    value: document.number || "Draft",
    x: leftX + 260,
    y: metaY,
    labelWidth: 92,
    valueWidth: 170,
    fontRegular,
    fontBold,
  });

  metaY -= 20;

  if (document.type === "invoice") {
    drawLabelValue({
      page,
      label: "Due Date",
      value: formatDate(document.due_date),
      x: leftX + 14,
      y: metaY,
      labelWidth: 70,
      valueWidth: 130,
      fontRegular,
      fontBold,
    });
  } else {
    drawLabelValue({
      page,
      label: "Reference",
      value:
        "This document records a reduction or reversal of billed amounts. It is not a payment request.",
      x: leftX + 14,
      y: metaY,
      labelWidth: 70,
      valueWidth: 390,
      fontRegular,
      fontBold,
    });
    metaY -= 20;
  }

  if (document.type === "credit_note" && document.original_invoice?.number) {
    drawLabelValue({
      page,
      label: "Original Invoice",
      value: `${document.original_invoice.number}${
        document.original_invoice.issue_date
          ? ` (${formatDate(document.original_invoice.issue_date)})`
          : ""
      }`,
      x: leftX + 14,
      y: metaY,
      labelWidth: 92,
      valueWidth: 320,
      fontRegular,
      fontBold,
    });
    metaY -= 20;
  }

  if (document.property) {
    const propertyLabel =
      document.property.title || document.property.property_code || "Property";
    const propertyLine = propertyAddress(document.property);

    drawLabelValue({
      page,
      label: "Property",
      value: propertyLine ? `${propertyLabel} — ${propertyLine}` : propertyLabel,
      x: leftX + 14,
      y: metaY,
      labelWidth: 70,
      valueWidth: 420,
      fontRegular,
      fontBold,
    });
  }

  return {
    ...ctx,
    cursorY: ctx.cursorY - metaBoxHeight - 22,
  };
}

function drawTableHeader(ctx: PdfContext): PdfContext {
  const { page, fontBold } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const tableWidth = rightX - leftX;

  page.drawRectangle({
    x: leftX,
    y: ctx.cursorY - HEADER_HEIGHT,
    width: tableWidth,
    height: HEADER_HEIGHT,
    color: PDF_COLORS.soft,
    borderColor: PDF_COLORS.border,
    borderWidth: 1,
  });

  const xDesc = leftX;
  const xQty = xDesc + TABLE.description;
  const xUnit = xQty + TABLE.qty;
  const xVat = xUnit + TABLE.unitPrice;
  const xTotal = xVat + TABLE.vat;

  const headerY = ctx.cursorY - 16;

  page.drawText("Description", {
    x: xDesc + 8,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Qty", {
    x: xQty + 8,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Unit Price", {
    x: xUnit + 8,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("VAT", {
    x: xVat + 8,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  page.drawText("Line Total", {
    x: xTotal + 8,
    y: headerY,
    size: 10,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  return {
    ...ctx,
    cursorY: ctx.cursorY - HEADER_HEIGHT,
  };
}

async function ensureRoomForTableRow(ctx: PdfContext): Promise<PdfContext> {
  if (ctx.cursorY > MIN_Y_BEFORE_NEW_PAGE) return ctx;

  let nextCtx = createPage({
    pdfDoc: ctx.pdfDoc,
    fontRegular: ctx.fontRegular,
    fontBold: ctx.fontBold,
    document: ctx.document,
    currency: ctx.currency,
  });

  nextCtx = await drawHeader(nextCtx);
  nextCtx = drawTableHeader(nextCtx);

  return nextCtx;
}

async function drawItemsTable(ctx: PdfContext): Promise<PdfContext> {
  let nextCtx = drawTableHeader(ctx);

  const leftX = PAGE.marginX;
  const xDesc = leftX;
  const xQty = xDesc + TABLE.description;
  const xUnit = xQty + TABLE.qty;
  const xVat = xUnit + TABLE.unitPrice;
  const xTotal = xVat + TABLE.vat;
  const tableWidth = PAGE.width - PAGE.marginX * 2;

  for (const item of nextCtx.document.items) {
    nextCtx = await ensureRoomForTableRow(nextCtx);

    const { page, fontRegular } = nextCtx;
    const rowY = nextCtx.cursorY - ROW_HEIGHT;

    page.drawRectangle({
      x: leftX,
      y: rowY,
      width: tableWidth,
      height: ROW_HEIGHT,
      borderColor: PDF_COLORS.border,
      borderWidth: 1,
    });

    const description = (item.description || "—").slice(0, 80);

    page.drawText(description, {
      x: xDesc + 8,
      y: rowY + 8,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(String(item.quantity), {
      x: xQty + 8,
      y: rowY + 8,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(formatCurrency(item.unit_price, nextCtx.currency), {
      x: xUnit + 8,
      y: rowY + 8,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(formatPercent(item.vat_rate), {
      x: xVat + 8,
      y: rowY + 8,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    page.drawText(formatCurrency(item.line_total, nextCtx.currency), {
      x: xTotal + 8,
      y: rowY + 8,
      size: 10,
      font: fontRegular,
      color: PDF_COLORS.text,
    });

    nextCtx = {
      ...nextCtx,
      cursorY: rowY,
    };
  }

  return {
    ...nextCtx,
    cursorY: nextCtx.cursorY - 26,
  };
}

function drawTotalsBox(ctx: PdfContext): PdfContext {
  const { page, fontRegular, fontBold, document, currency } = ctx;
  const rightX = PAGE.width - PAGE.marginX;
  const totalsBoxWidth = 220;
  const totalsBoxHeight = 82;
  const totalsBoxX = rightX - totalsBoxWidth;

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

  const rows = [
    ["Subtotal", formatCurrency(document.subtotal, currency)],
    ["VAT", formatCurrency(document.vat_total, currency)],
    ["Total", formatCurrency(document.total, currency)],
  ];

  let y = ctx.cursorY - 18;

  rows.forEach(([label, value], index) => {
    const size = index === 2 ? 11 : 10;
    const isTotal = index === 2;

    page.drawText(label, {
      x: totalsBoxX + 12,
      y,
      size,
      font: isTotal ? fontBold : fontRegular,
      color: isTotal ? PDF_COLORS.text : PDF_COLORS.muted,
    });

    const textFont = isTotal ? fontBold : fontRegular;
    page.drawText(value, {
      x:
        totalsBoxX +
        totalsBoxWidth -
        12 -
        textFont.widthOfTextAtSize(value, size),
      y,
      size,
      font: textFont,
      color: PDF_COLORS.text,
    });

    y -= 22;
  });

  return {
    ...ctx,
    cursorY: ctx.cursorY - totalsBoxHeight - 24,
  };
}

function drawBottomSections(ctx: PdfContext): PdfContext {
  const { page, document, fontBold, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const contentWidth = rightX - leftX;
  const totalsBoxWidth = 220;

  if (document.type === "invoice") {
    page.drawText("Payment Details", {
      x: leftX,
      y: ctx.cursorY,
      size: 11,
      font: fontBold,
      color: PDF_COLORS.muted,
    });

    let y = ctx.cursorY - 16;

    const accounts = (document.company_bank_accounts || [])
      .filter((a) => a.iban)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

    const lines: string[] = [];

    for (const acc of accounts) {
      const parts = [
        acc.account_name || "",
        acc.bank_name || "",
        acc.iban ? `IBAN: ${acc.iban}` : "",
        acc.swift ? `SWIFT: ${acc.swift}` : "",
      ].filter(Boolean);

      if (parts.length) {
        lines.push(parts.join(" — "));
      }
    }

    if (document.payment_reference) {
      lines.push(`Reference: ${document.payment_reference}`);
    }

    const text =
      lines.length > 0
        ? lines.join("\n")
        : "No payment information available.";

    y =
      drawTextBlock({
        page,
        text,
        x: leftX,
        y,
        maxWidth: contentWidth - totalsBoxWidth - 20,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.text,
      }) - 18;

    ctx = { ...ctx, cursorY: y };
  } else {
    page.drawText("Credit Note", {
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
        text:
          "This credit note records a reduction or reversal of previously billed amounts. It is not a request for payment.",
        x: leftX,
        y,
        maxWidth: contentWidth - totalsBoxWidth - 20,
        font: fontRegular,
        fontSize: 10,
        color: PDF_COLORS.text,
      }) - 18;

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
        color: PDF_COLORS.text,
      }) - 16;

    ctx = { ...ctx, cursorY: y };
  }

  return ctx;
}

function drawFooter(ctx: PdfContext): PdfContext {
  const { page, document, fontRegular } = ctx;
  const leftX = PAGE.marginX;
  const rightX = PAGE.width - PAGE.marginX;
  const footerY = PAGE.marginBottom - 4;

  drawHorizontalRule(page, footerY + 18);

  const leftText = document.company.company_name || "";
  const rightText = [
    document.company.vat_number ? `VAT: ${document.company.vat_number}` : "",
    document.company.business_number
      ? `Business No: ${document.company.business_number}`
      : "",
    document.company.website || "",
  ]
    .filter(Boolean)
    .join("   ");

  page.drawText(leftText, {
    x: leftX,
    y: footerY,
    size: 9,
    font: fontRegular,
    color: PDF_COLORS.muted,
  });

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

export async function generateBillingPdf({
  document,
}: GenerateBillingPdfOptions): Promise<{
  bytes: Uint8Array;
  filename: string;
}> {
  const pdfDoc = await PDFDocument.create();
  const { fontRegular, fontBold } = await loadPdfAssets(pdfDoc);

  let ctx = createPage({
    pdfDoc,
    fontRegular,
    fontBold,
    document,
    currency: document.currency || "EUR",
  });

  ctx = await drawHeader(ctx);
  ctx = drawPartyBlocks(ctx);
  ctx = drawMetaBox(ctx);
  ctx = await drawItemsTable(ctx);
  ctx = drawTotalsBox(ctx);
  ctx = drawBottomSections(ctx);
  ctx = drawFooter(ctx);

  const bytes = await pdfDoc.save();

  return {
    bytes,
    filename: normalizeFilename(document),
  };
}