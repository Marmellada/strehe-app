import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type Color,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import { hasRequiredRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

type ClientRelation =
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }
  | {
      id: string;
      full_name: string | null;
      company_name: string | null;
    }[]
  | null;

type PropertyRelation =
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }
  | {
      id: string;
      title: string | null;
      property_code: string | null;
      address_line_1: string | null;
    }[]
  | null;

type PackageRelation =
  | {
      id: string;
      name: string | null;
      monthly_price: number | string | null;
      description: string | null;
    }
  | {
      id: string;
      name: string | null;
      monthly_price: number | string | null;
      description: string | null;
    }[]
  | null;

type ServiceRelation =
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      default_priority: string | null;
      default_title: string | null;
      is_active: boolean | null;
    }
  | {
      id: string;
      name: string | null;
      category: string | null;
      base_price: number | string | null;
      default_priority: string | null;
      default_title: string | null;
      is_active: boolean | null;
    }[]
  | null;

type PackageServiceRow = {
  id: string;
  package_id: string;
  service_id: string;
  included_quantity: number | null;
  service: ServiceRelation;
};

type PromotionCodeRelation =
  | {
      id: string;
      code: string | null;
    }
  | {
      id: string;
      code: string | null;
    }[]
  | null;

type SubscriptionRow = {
  id: string;
  client_name_snapshot: string | null;
  property_code_snapshot: string | null;
  package_name_snapshot: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  monthly_price: number | string | null;
  original_monthly_price: number | string | null;
  discount_type: string | null;
  discount_percent: number | string | null;
  discount_amount_cents: number | null;
  discounted_monthly_price: number | string | null;
  promotion_summary_snapshot: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  client: ClientRelation;
  property: PropertyRelation;
  package: PackageRelation;
  promotion_code: PromotionCodeRelation;
};

type CompanySettingsRow = Record<string, unknown> | null;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLORS = {
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.4, 0.4, 0.4),
  light: rgb(0.92, 0.94, 0.97),
  line: rgb(0.85, 0.88, 0.92),
  accent: rgb(0.12, 0.25, 0.52),
  accentSoft: rgb(0.94, 0.96, 0.99),
  success: rgb(0.12, 0.45, 0.22),
  white: rgb(1, 1, 1),
};

function getSingleRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "-";

  return `€${num.toFixed(2)}`;
}

function formatMoneyFromCents(value: number | null | undefined) {
  return `€${((value || 0) / 100).toFixed(2)}`;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "-";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char: string) => char.toUpperCase());
}

function getSettingString(
  settings: CompanySettingsRow,
  keys: string[],
  fallback = ""
) {
  if (!settings) return fallback;

  for (const key of keys) {
    const value = settings[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return fallback;
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);

    if (width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let partial = "";
    for (const char of word) {
      const test = partial + char;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        partial = test;
      } else {
        if (partial) lines.push(partial);
        partial = char;
      }
    }
    current = partial;
  }

  if (current) lines.push(current);

  return lines.length > 0 ? lines : [""];
}

function measureWrappedHeight(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
  lineHeight: number
) {
  return wrapText(text, maxWidth, font, size).length * lineHeight;
}

async function fetchImageBytes(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const bytes = await response.arrayBuffer();

    return { bytes, contentType };
  } catch {
    return null;
  }
}

function normalizeStoragePath(path: string) {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "")
    .replace(/^object\/public\/[^/]+\//, "");
}

function getPublicLogoUrlFromStorage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companySettings: CompanySettingsRow
) {
  if (!companySettings) return "";

  const storagePath = getSettingString(
    companySettings,
    ["logo_path", "company_logo_path", "brand_logo_path"],
    ""
  );

  if (!storagePath) return "";

  const bucketName = getSettingString(
    companySettings,
    ["logo_bucket", "company_logo_bucket", "brand_logo_bucket"],
    "company-assets"
  );

  const normalizedPath = normalizeStoragePath(storagePath);

  if (!normalizedPath) return "";

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(normalizedPath);

  return data?.publicUrl || "";
}

async function tryEmbedLogo(
  pdf: PDFDocument,
  supabase: Awaited<ReturnType<typeof createClient>>,
  companySettings: CompanySettingsRow
): Promise<PDFImage | null> {
  const directLogoUrl = getSettingString(
    companySettings,
    ["logo_url", "logo", "company_logo_url", "brand_logo_url"],
    ""
  );

  const resolvedLogoUrl =
    directLogoUrl || getPublicLogoUrlFromStorage(supabase, companySettings);

  if (!resolvedLogoUrl) return null;

  const file = await fetchImageBytes(resolvedLogoUrl);
  if (!file) return null;

  try {
    const type = file.contentType.toLowerCase();

    if (type.includes("png")) {
      return await pdf.embedPng(file.bytes);
    }

    if (type.includes("jpg") || type.includes("jpeg")) {
      return await pdf.embedJpg(file.bytes);
    }

    try {
      return await pdf.embedPng(file.bytes);
    } catch {
      return await pdf.embedJpg(file.bytes);
    }
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUserWithRole();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

   if (
    !currentUser.appUser.is_active ||
    !hasRequiredRole(currentUser.appUser.role, ["admin", "office"])
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { id } = await context.params;

  if (!id || id === "undefined") {
    return NextResponse.json({ error: "Invalid contract id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const forceDownload = url.searchParams.get("download") === "1";

  const [{ data, error }, { data: companySettings }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        `
        id,
        client_name_snapshot,
        property_code_snapshot,
        package_name_snapshot,
        start_date,
        end_date,
        status,
        monthly_price,
        original_monthly_price,
        discount_type,
        discount_percent,
        discount_amount_cents,
        discounted_monthly_price,
        promotion_summary_snapshot,
        notes,
        created_at,
        updated_at,
        client:clients!subscriptions_client_fk (
          id,
          full_name,
          company_name
        ),
        property:properties!subscriptions_property_fk (
          id,
          title,
          property_code,
          address_line_1
        ),
        package:packages!subscriptions_package_fk (
          id,
          name,
          monthly_price,
          description
        ),
        promotion_code:promotion_codes (
          id,
          code
        )
      `
      )
      .eq("id", id)
      .single(),
    supabase.from("company_settings").select("*").limit(1).maybeSingle(),
  ]);

  if (error || !data) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const subscription = data as SubscriptionRow;
  const pkg = getSingleRelation(subscription.package);
  const client = getSingleRelation(subscription.client);
  const property = getSingleRelation(subscription.property);
  const promotionCode = getSingleRelation(subscription.promotion_code);

  const { data: includedServices, error: servicesError } = await supabase
    .from("package_services")
    .select(
      `
      id,
      package_id,
      service_id,
      included_quantity,
      service:services!package_services_service_fk (
        id,
        name,
        category,
        base_price,
        default_priority,
        default_title,
        is_active
      )
    `
    )
    .eq("package_id", pkg?.id || "")
    .order("created_at", { ascending: true });

  if (servicesError) {
    return NextResponse.json({ error: servicesError.message }, { status: 500 });
  }

  const serviceRows = (includedServices || []) as PackageServiceRow[];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await tryEmbedLogo(pdf, supabase, companySettings);

  const companyName = getSettingString(
    companySettings,
    ["company_name", "legal_name", "name"],
    "STREHË Prona"
  );

  const companyAddress = getSettingString(
    companySettings,
    ["address", "address_line_1", "street_address"],
    "-"
  );

  const companyEmail = getSettingString(
    companySettings,
    ["email", "company_email", "contact_email"],
    "-"
  );

  const companyPhone = getSettingString(
    companySettings,
    ["phone", "company_phone", "contact_phone"],
    "-"
  );

  const clientName =
    subscription.client_name_snapshot ||
    client?.company_name ||
    client?.full_name ||
    "-";
  const propertyName = subscription.property_code_snapshot
    ? property?.title
      ? `${subscription.property_code_snapshot} - ${property.title}`.trim()
      : subscription.property_code_snapshot
    : property?.property_code
    ? `${property.property_code} - ${property.title || ""}`.trim()
    : property?.title || "-";
  const packageName = subscription.package_name_snapshot || pkg?.name || "-";

  const contractTitle = "APARTMENT CARE SERVICE AGREEMENT";
  const statusText = formatLabel(subscription.status);
  const contractPrice = formatPrice(subscription.monthly_price);
  const packagePrice = formatPrice(pkg?.monthly_price);
  const hasPromotion = Boolean(subscription.promotion_summary_snapshot);
  const contractPriceItems = [
    { label: "Status", value: statusText },
    ...(hasPromotion
      ? [
          {
            label: "Original Price",
            value: formatPrice(subscription.original_monthly_price),
          },
          {
            label: "Discount",
            value:
              subscription.promotion_summary_snapshot ||
              (subscription.discount_amount_cents
                ? formatMoneyFromCents(subscription.discount_amount_cents)
                : "-"),
          },
          {
            label: "Promotion Code",
            value: promotionCode?.code || "-",
          },
        ]
      : []),
    { label: "Contract Price", value: contractPrice },
    { label: "Package Default Price", value: packagePrice },
    { label: "Start Date", value: formatDate(subscription.start_date) },
    { label: "End Date", value: formatDate(subscription.end_date) },
  ];
  const contractTerms = [
    {
      title: "1. Service scope",
      body:
        "STREHE provides apartment care services according to the selected package, included services, agreed visit frequency, and written notes in this agreement. Services outside the package are handled as add-ons or separately approved work.",
    },
    {
      title: "2. Client responsibilities",
      body:
        "The client confirms that they are authorized to request services for the property and will provide accurate property information, access instructions, emergency contacts, and any safety or building rules needed for visits.",
    },
    {
      title: "3. Access and keys",
      body:
        "The client authorizes STREHE to access the property for agreed visits, checks, reports, and approved coordination work. Keys and access devices are logged internally and must be returned or updated when access changes.",
    },
    {
      title: "4. Visit reports and photos",
      body:
        "STREHE may take practical photos, notes, and visit reports to document property condition, completed work, issues found, and service quality. These materials are used for client reporting and internal service records.",
    },
    {
      title: "5. Payments and invoices",
      body:
        "Monthly service fees, add-ons, and approved extra work are invoiced according to the agreed package price and invoice terms. The client should pay invoices by the stated due date using the payment details shown on the invoice.",
    },
    {
      title: "6. Repairs and urgent issues",
      body:
        "STREHE may identify and report urgent issues. Repairs, parts, technician costs, and third-party work are not included unless clearly stated in the package or approved by the client. In urgent situations, STREHE will make reasonable efforts to contact the client before coordinating action.",
    },
    {
      title: "7. Exclusions",
      body:
        "Unless separately agreed, this service does not include legal representation, tenant brokerage, insurance, utility contracts, renovation supervision, major repairs, or guaranteed prevention of damage, theft, weather impact, or building-wide issues.",
    },
    {
      title: "8. Cancellation and changes",
      body:
        "Either party may request cancellation, pause, or package changes in writing. Services already performed, approved add-ons, and issued invoices remain payable. Access items must be returned or disabled when the service ends.",
    },
    {
      title: "9. Liability and care standard",
      body:
        "STREHE will perform services with reasonable care and keep clear records. STREHE is not responsible for pre-existing conditions, hidden defects, third-party actions, building administration decisions, force majeure events, or losses outside its direct control.",
    },
    {
      title: "10. Agreement records",
      body:
        "This agreement, package snapshot, included services, signed confirmation, invoices, reports, and written client approvals form the operational record for the service.",
    },
  ];

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function addPage() {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
    drawHeader();
    drawFooterPlaceholder();
    y = PAGE_HEIGHT - 110;
  }

  function ensureSpace(height: number) {
    if (y - height < MARGIN_BOTTOM + 20) {
      addPage();
    }
  }

  function drawText(
    text: string,
    opts?: {
      x?: number;
      y?: number;
      size?: number;
      bold?: boolean;
      color?: Color;
    }
  ) {
    page.drawText(text, {
      x: opts?.x ?? MARGIN_X,
      y: opts?.y ?? y,
      size: opts?.size ?? 11,
      font: opts?.bold ? fontBold : font,
      color: opts?.color ?? COLORS.text,
    });
  }

  function drawWrappedBlock(params: {
    text: string;
    x: number;
    y: number;
    width: number;
    size?: number;
    bold?: boolean;
    color?: Color;
    lineHeight?: number;
  }) {
    const size = params.size ?? 11;
    const usedFont = params.bold ? fontBold : font;
    const lineHeight = params.lineHeight ?? size + 3;
    const lines = wrapText(params.text, params.width, usedFont, size);

    let cursorY = params.y;
    for (const line of lines) {
      page.drawText(line, {
        x: params.x,
        y: cursorY,
        size,
        font: usedFont,
        color: params.color ?? COLORS.text,
      });
      cursorY -= lineHeight;
    }

    return cursorY;
  }

  function drawLine(yPos: number) {
    page.drawLine({
      start: { x: MARGIN_X, y: yPos },
      end: { x: PAGE_WIDTH - MARGIN_X, y: yPos },
      thickness: 1,
      color: COLORS.line,
    });
  }

  function drawHeader() {
    const topY = PAGE_HEIGHT - 42;

    if (logoImage) {
      const maxW = 78;
      const maxH = 34;
      const scaled = logoImage.scale(1);
      const ratio = Math.min(maxW / scaled.width, maxH / scaled.height, 1);
      const width = scaled.width * ratio;
      const height = scaled.height * ratio;

      page.drawImage(logoImage, {
        x: MARGIN_X,
        y: topY - height,
        width,
        height,
      });
    }

    const rightX = PAGE_WIDTH - MARGIN_X - 210;
    page.drawText(companyName, {
      x: rightX,
      y: topY - 2,
      size: 11,
      font: fontBold,
      color: COLORS.text,
    });

    page.drawText(companyAddress || "-", {
      x: rightX,
      y: topY - 16,
      size: 8.5,
      font,
      color: COLORS.muted,
    });

    page.drawText(`${companyEmail}   |   ${companyPhone}`, {
      x: rightX,
      y: topY - 28,
      size: 8.5,
      font,
      color: COLORS.muted,
    });

    drawLine(PAGE_HEIGHT - 76);
  }

  function drawFooterPlaceholder() {
    drawLine(40);
  }

  function drawSectionTitle(title: string) {
    y -= 8;
    ensureSpace(28);

    page.drawRectangle({
      x: MARGIN_X,
      y: y - 6,
      width: CONTENT_WIDTH,
      height: 20,
      color: COLORS.accentSoft,
      borderColor: COLORS.line,
      borderWidth: 1,
    });

    page.drawText(title, {
      x: MARGIN_X + 10,
      y,
      size: 11,
      font: fontBold,
      color: COLORS.accent,
    });

    y -= 24;
  }

  function drawInfoCard(params: {
    title: string;
    items: Array<{ label: string; value: string }>;
    x: number;
    yTop: number;
    width: number;
  }) {
    const innerPadding = 10;
    const labelSize = 8.5;
    const valueSize = 10;
    const labelGap = 11;
    const itemGap = 6;
    const valueLineHeight = 13;

    let totalHeight = 16;

    for (const item of params.items) {
      totalHeight += labelGap;
      totalHeight += measureWrappedHeight(
        item.value || "-",
        params.width - innerPadding * 2,
        font,
        valueSize,
        valueLineHeight
      );
      totalHeight += itemGap;
    }

    const boxHeight = Math.max(totalHeight, 78);

    page.drawRectangle({
      x: params.x,
      y: params.yTop - boxHeight,
      width: params.width,
      height: boxHeight,
      color: COLORS.white,
      borderColor: COLORS.line,
      borderWidth: 1,
    });

    page.drawText(params.title, {
      x: params.x + innerPadding,
      y: params.yTop - 14,
      size: 10,
      font: fontBold,
      color: COLORS.accent,
    });

    let cursorY = params.yTop - 30;

    for (const item of params.items) {
      page.drawText(item.label, {
        x: params.x + innerPadding,
        y: cursorY,
        size: labelSize,
        font: fontBold,
        color: COLORS.muted,
      });

      cursorY -= labelGap;

      cursorY = drawWrappedBlock({
        text: item.value || "-",
        x: params.x + innerPadding,
        y: cursorY,
        width: params.width - innerPadding * 2,
        size: valueSize,
        color: COLORS.text,
        lineHeight: valueLineHeight,
      });

      cursorY -= itemGap;
    }

    return params.yTop - boxHeight - 8;
  }

  function drawServicesTable() {
    if (serviceRows.length === 0) {
      ensureSpace(40);

      page.drawRectangle({
        x: MARGIN_X,
        y: y - 24,
        width: CONTENT_WIDTH,
        height: 24,
        color: COLORS.white,
        borderColor: COLORS.line,
        borderWidth: 1,
      });

      page.drawText("No services are linked to this package.", {
        x: MARGIN_X + 10,
        y: y - 16,
        size: 9.5,
        font,
        color: COLORS.muted,
      });

      y -= 36;
      return;
    }

    const colWidths = [150, 95, 55, 75, 100];
    const headers = ["Service", "Category", "Qty/Month", "Base Price", "Status"];
    const tableX = MARGIN_X;
    const headerHeight = 24;

    ensureSpace(40);

    page.drawRectangle({
      x: tableX,
      y: y - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: COLORS.light,
      borderColor: COLORS.line,
      borderWidth: 1,
    });

    let colX = tableX;
    headers.forEach((header, index) => {
      page.drawText(header, {
        x: colX + 6,
        y: y - 15,
        size: 9,
        font: fontBold,
        color: COLORS.text,
      });
      colX += colWidths[index];
    });

    y -= headerHeight;

    for (const row of serviceRows) {
      const service = getSingleRelation(row.service);

      const serviceName = service?.name || "Unnamed Service";
      const category = formatLabel(service?.category);
      const quantity = String(row.included_quantity ?? "-");
      const basePrice = formatPrice(service?.base_price);
      const status = service?.is_active ? "Active" : "Inactive";

      const serviceLines = wrapText(serviceName, colWidths[0] - 12, font, 9);
      const rowHeight = Math.max(24, serviceLines.length * 12 + 8);

      ensureSpace(rowHeight + 12);

      page.drawRectangle({
        x: tableX,
        y: y - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        color: COLORS.white,
        borderColor: COLORS.line,
        borderWidth: 1,
      });

      let x = tableX;

      let lineY = y - 14;
      for (const line of serviceLines) {
        page.drawText(line, {
          x: x + 6,
          y: lineY,
          size: 9,
          font,
          color: COLORS.text,
        });
        lineY -= 12;
      }
      x += colWidths[0];

      page.drawText(category, {
        x: x + 6,
        y: y - 14,
        size: 9,
        font,
        color: COLORS.text,
      });
      x += colWidths[1];

      page.drawText(quantity, {
        x: x + 6,
        y: y - 14,
        size: 9,
        font,
        color: COLORS.text,
      });
      x += colWidths[2];

      page.drawText(basePrice, {
        x: x + 6,
        y: y - 14,
        size: 9,
        font,
        color: COLORS.text,
      });
      x += colWidths[3];

      page.drawText(status, {
        x: x + 6,
        y: y - 14,
        size: 9,
        font,
        color: service?.is_active ? COLORS.success : COLORS.muted,
      });

      y -= rowHeight;

      if (service?.default_title) {
        ensureSpace(24);

        page.drawRectangle({
          x: tableX,
          y: y - 20,
          width: CONTENT_WIDTH,
          height: 20,
          color: COLORS.accentSoft,
          borderColor: COLORS.line,
          borderWidth: 1,
        });

        page.drawText(`Default Task Title: ${service.default_title}`, {
          x: tableX + 8,
          y: y - 13,
          size: 8.5,
          font,
          color: COLORS.muted,
        });

        y -= 20;
      }

      y -= 4;
    }
  }

  function drawTermsList() {
    const titleSize = 9.4;
    const bodySize = 9.2;
    const bodyLineHeight = 12.4;
    const termGap = 8;

    for (const term of contractTerms) {
      const bodyHeight = measureWrappedHeight(
        term.body,
        CONTENT_WIDTH,
        font,
        bodySize,
        bodyLineHeight
      );
      const blockHeight = 14 + bodyHeight + termGap;

      ensureSpace(blockHeight + 4);

      page.drawText(term.title, {
        x: MARGIN_X,
        y,
        size: titleSize,
        font: fontBold,
        color: COLORS.accent,
      });

      y -= 13;
      y = drawWrappedBlock({
        text: term.body,
        x: MARGIN_X,
        y,
        width: CONTENT_WIDTH,
        size: bodySize,
        color: COLORS.text,
        lineHeight: bodyLineHeight,
      });
      y -= termGap;
    }
  }

  drawHeader();
  drawFooterPlaceholder();

  y = PAGE_HEIGHT - 108;

  drawText(contractTitle, {
    size: 19,
    bold: true,
    color: COLORS.text,
  });

  const statusWidth = fontBold.widthOfTextAtSize(statusText, 9.5);
  page.drawRectangle({
    x: PAGE_WIDTH - MARGIN_X - statusWidth - 18,
    y: y - 1,
    width: statusWidth + 12,
    height: 18,
    color: COLORS.accentSoft,
    borderColor: COLORS.line,
    borderWidth: 1,
  });

  page.drawText(statusText, {
    x: PAGE_WIDTH - MARGIN_X - statusWidth - 12,
    y: y + 4,
    size: 9.5,
    font: fontBold,
    color: COLORS.accent,
  });

  y -= 24;

  drawText(`Contract ID: ${subscription.id}`, {
    size: 9.5,
    color: COLORS.muted,
  });
  y -= 14;

  drawText(
    `Start: ${formatDate(subscription.start_date)}   |   End: ${formatDate(
      subscription.end_date
    )}   |   Monthly Price: ${contractPrice}`,
    {
      size: 9.5,
      color: COLORS.muted,
    }
  );

  y -= 18;
  drawLine(y);
  y -= 20;

  drawSectionTitle("Parties");

  const cardGap = 14;
  const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + cardWidth + cardGap;

  const leftBottom = drawInfoCard({
    title: "Client",
    x: leftX,
    yTop: y,
    width: cardWidth,
    items: [
      { label: "Name", value: clientName },
      { label: "Type", value: client?.company_name ? "Company" : "Individual" },
    ],
  });

  const rightBottom = drawInfoCard({
    title: "Company",
    x: rightX,
    yTop: y,
    width: cardWidth,
    items: [
      { label: "Name", value: companyName },
      { label: "Address", value: companyAddress || "-" },
      { label: "Email", value: companyEmail || "-" },
      { label: "Phone", value: companyPhone || "-" },
    ],
  });

  y = Math.min(leftBottom, rightBottom) - 4;

  drawSectionTitle("Contract Details");

  const detailsLeftBottom = drawInfoCard({
    title: "Subscription",
    x: leftX,
    yTop: y,
    width: cardWidth,
    items: contractPriceItems,
  });

  const detailsRightBottom = drawInfoCard({
    title: "Property & Package",
    x: rightX,
    yTop: y,
    width: cardWidth,
    items: [
      { label: "Property", value: propertyName },
      { label: "Address", value: property?.address_line_1 || "-" },
      { label: "Package", value: packageName },
    ],
  });

  y = Math.min(detailsLeftBottom, detailsRightBottom) - 4;

  drawSectionTitle("Package Description");

  ensureSpace(60);
  y = drawWrappedBlock({
    text: pkg?.description || "No package description provided.",
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    size: 10.5,
    color: COLORS.text,
    lineHeight: 15,
  });
  y -= 10;

  drawSectionTitle("Included Services");
  drawServicesTable();

  drawSectionTitle("Notes");

  ensureSpace(60);
  y = drawWrappedBlock({
    text: subscription.notes || "No notes provided.",
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    size: 10.5,
    color: COLORS.text,
    lineHeight: 15,
  });
  y -= 12;

  drawSectionTitle("Agreement Terms");
  drawTermsList();
  y -= 4;

  drawSectionTitle("Signatures");

  ensureSpace(110);

  const signatureWidth = (CONTENT_WIDTH - 30) / 2;
  const signY = y - 24;

  page.drawLine({
    start: { x: MARGIN_X, y: signY },
    end: { x: MARGIN_X + signatureWidth, y: signY },
    thickness: 1,
    color: COLORS.line,
  });

  page.drawLine({
    start: { x: MARGIN_X + signatureWidth + 30, y: signY },
    end: {
      x: MARGIN_X + signatureWidth + 30 + signatureWidth,
      y: signY,
    },
    thickness: 1,
    color: COLORS.line,
  });

  page.drawText("Client Signature", {
    x: MARGIN_X,
    y: signY - 14,
    size: 9,
    font,
    color: COLORS.muted,
  });

  page.drawText(`${companyName} Signature`, {
    x: MARGIN_X + signatureWidth + 30,
    y: signY - 14,
    size: 9,
    font,
    color: COLORS.muted,
  });

  page.drawText("Date / Place", {
    x: MARGIN_X,
    y: signY - 28,
    size: 8.5,
    font,
    color: COLORS.muted,
  });

  page.drawText("Date / Place", {
    x: MARGIN_X + signatureWidth + 30,
    y: signY - 28,
    size: 8.5,
    font,
    color: COLORS.muted,
  });

  y = signY - 34;

  const pages = pdf.getPages();
  const totalPages = pages.length;

  pages.forEach((p, index) => {
    const footerTextLeft = companyName;
    const footerTextRight = `Page ${index + 1} of ${totalPages}`;

    p.drawLine({
      start: { x: MARGIN_X, y: 40 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 40 },
      thickness: 1,
      color: COLORS.line,
    });

    p.drawText(footerTextLeft, {
      x: MARGIN_X,
      y: 24,
      size: 8.5,
      font,
      color: COLORS.muted,
    });

    const width = font.widthOfTextAtSize(footerTextRight, 8.5);
    p.drawText(footerTextRight, {
      x: PAGE_WIDTH - MARGIN_X - width,
      y: 24,
      size: 8.5,
      font,
      color: COLORS.muted,
    });
  });

  const bytes = await pdf.save();
  const safeFileName = `contract-${subscription.id}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${
        forceDownload ? "attachment" : "inline"
      }; filename="${safeFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
