import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

export type BillingPdfMode = "invoice" | "credit_note";

export type CompanyBankAccountPdfData = {
  id: string;
  account_name: string | null;
  bank_name: string | null;
  iban: string;
  swift: string | null;
  is_primary: boolean;
};

export type CompanyPdfData = {
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  vat_number: string | null;
  business_number: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
};

export type ClientPdfData = {
  full_name: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  vat_number?: string | null;
  business_number?: string | null;
};

export type PropertyPdfData = {
  property_code?: string | null;
  title?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type BillingLineItemPdfData = {
  description: string;
  quantity: number;
  unit_price: number;
  original_unit_price?: number | null;
  discount_amount?: number | null;
  promotion_summary?: string | null;
  vat_rate: number;
  line_total: number;
};

export type BillingDocumentPdfData = {
  id: string;
  type: BillingPdfMode;
  number: string | null;
  issue_date: string | null;
  due_date?: string | null;
  currency?: string | null;
  notes?: string | null;
  payment_reference?: string | null;

  subtotal: number;
  vat_total: number;
  total: number;

  client: ClientPdfData;
  property?: PropertyPdfData | null;
  company: CompanyPdfData;
  company_bank_accounts: CompanyBankAccountPdfData[];
  items: BillingLineItemPdfData[];

  original_invoice?: {
    id: string;
    number: string | null;
    issue_date?: string | null;
  } | null;
};

export const PDF_COLORS = {
  text: rgb(0.11, 0.11, 0.12),
  muted: rgb(0.42, 0.45, 0.49),
  border: rgb(0.86, 0.88, 0.91),
  soft: rgb(0.96, 0.97, 0.98),
  accent: rgb(0.14, 0.27, 0.48),
  noteSoft: rgb(0.98, 0.94, 0.94),
};

export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  marginTop: 52,
  marginBottom: 48,
};

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function formatCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

export function formatPercent(value: number): string {
  return `${safeNumber(value).toFixed(0)}%`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function compactAddress(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export function companyAddress(company: CompanyPdfData): string {
  return compactAddress([
    company.address_line_1,
    company.address_line_2,
    compactAddress([company.postal_code, company.city]),
    company.country,
  ]);
}

export function clientAddrress(client: ClientPdfData): string {
  return compactAddress([
    client.address_line_1,
    client.address_line_2,
    compactAddress([client.postal_code, client.city]),
    client.country,
  ]);
}

export function propertyAddress(property?: PropertyPdfData | null): string {
  if (!property) return "";

  return compactAddress([
    property.address_line_1,
    property.address_line_2,
    compactAddress([property.postal_code, property.city]),
    property.country,
  ]);
}

export async function loadPdfAssets(pdfDoc: PDFDocument) {
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  return { fontRegular, fontBold };
}

export function looksLikePublicUrl(value?: string | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

export async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function embedLogoFromUrl(
  pdfDoc: PDFDocument,
  url?: string | null
): Promise<PDFImage | null> {
  if (!url) return null;

  const bytes = await fetchBinary(url);
  if (!bytes) return null;

  const lower = url.toLowerCase();

  if (lower.endsWith(".png")) {
    return await pdfDoc.embedPng(bytes);
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return await pdfDoc.embedJpg(bytes);
  }

  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

export function splitText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safeText = String(text || "");
  const paragraphs = safeText.split("\n");
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      result.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);

      if (width <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        result.push(current);
      }

      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }

      let chunk = "";
      for (const char of word) {
        const candidateChunk = chunk + char;
        if (font.widthOfTextAtSize(candidateChunk, fontSize) <= maxWidth) {
          chunk = candidateChunk;
        } else {
          if (chunk) result.push(chunk);
          chunk = char;
        }
      }

      current = chunk;
    }

    if (current) {
      result.push(current);
    }
  }

  return result.length ? result : [""];
}

export function drawTextBlock(params: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  fontSize: number;
  lineHeight?: number;
  color?: RGB;
}) {
  const {
    page,
    text,
    x,
    y,
    maxWidth,
    font,
    fontSize,
    lineHeight = fontSize + 3,
    color = PDF_COLORS.text,
  } = params;

  const paragraphs = String(text || "").split("\n");
  let cursorY = y;

  for (const paragraph of paragraphs) {
    const lines = splitText(paragraph || "", font, fontSize, maxWidth);

    for (const line of lines) {
      page.drawText(line, {
        x,
        y: cursorY,
        size: fontSize,
        font,
        color,
      });
      cursorY -= lineHeight;
    }
  }

  return cursorY;
}

export function drawHorizontalRule(page: PDFPage, y: number) {
  page.drawLine({
    start: { x: PAGE.marginX, y },
    end: { x: PAGE.width - PAGE.marginX, y },
    thickness: 1,
    color: PDF_COLORS.border,
  });
}

export function drawLabelValue(params: {
  page: PDFPage;
  label: string;
  value: string;
  x: number;
  y: number;
  labelWidth: number;
  valueWidth: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  fontSize?: number;
}) {
  const {
    page,
    label,
    value,
    x,
    y,
    labelWidth,
    valueWidth,
    fontRegular,
    fontBold,
    fontSize = 10,
  } = params;

  page.drawText(label, {
    x,
    y,
    size: fontSize,
    font: fontBold,
    color: PDF_COLORS.muted,
  });

  drawTextBlock({
    page,
    text: value || "—",
    x: x + labelWidth,
    y,
    maxWidth: valueWidth,
    font: fontRegular,
    fontSize,
    color: PDF_COLORS.text,
  });
}

export function resolveBillingLabel(mode: BillingPdfMode): string {
  return mode === "credit_note" ? "CREDIT NOTE" : "INVOICE";
}

export function resolveBillingPrefix(mode: BillingPdfMode): string {
  return mode === "credit_note" ? "CN" : "INV";
}

export function normalizeFilename(doc: BillingDocumentPdfData): string {
  const prefix = resolveBillingPrefix(doc.type);
  const number = (doc.number || doc.id).replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${prefix}_${number}.pdf`;
}
