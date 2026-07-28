import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PAGE, splitText } from "@/components/billing/pdf/shared";
import { FOUNDING_PACKAGES, STANDARD_EXCLUSIONS, type FoundingPackageKey } from "./definitions";

export type OfferPdfData = {
  offer_number: string;
  version: number;
  selected_package: FoundingPackageKey;
  monthly_price_cents: number;
  founding_customer_eligible: boolean;
  price_lock_statement: string | null;
  property_service_area_summary: string;
  visit_frequency: string;
  included_services: string;
  exclusions: string;
  normal_approval_limit_cents: number;
  emergency_limit_cents: number;
  proposed_start_date: string | null;
  valid_until: string | null;
  consultation_summary: string | null;
  additional_agreed_items: string | null;
  lead: { full_name: string | null; email: string | null; phone: string | null };
};

export async function generateOfferPdf(offer: OfferPdfData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.marginTop;
  const width = PAGE.width - PAGE.marginX * 2;

  const ensure = (height: number) => {
    if (y - height >= PAGE.marginBottom) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.marginTop;
  };

  const heading = (value: string, size = 12) => {
    ensure(size + 18);
    page.drawText(value, { x: PAGE.marginX, y, size, font: bold, color: rgb(0.14, 0.27, 0.48) });
    y -= size + 9;
  };

  const paragraph = (value: string, size = 10) => {
    const lines = splitText(value || "-", regular, size, width);
    ensure(lines.length * (size + 4) + 8);
    for (const line of lines) {
      page.drawText(line, { x: PAGE.marginX, y, size, font: regular, color: rgb(0.12, 0.12, 0.13) });
      y -= size + 4;
    }
    y -= 7;
  };

  page.drawText("STREHË", { x: PAGE.marginX, y, size: 20, font: bold, color: rgb(0.14, 0.27, 0.48) });
  page.drawText("PROPOZIM SHËRBIMI", { x: PAGE.width - PAGE.marginX - 190, y, size: 15, font: bold });
  y -= 34;
  paragraph(`Oferta: ${offer.offer_number} · Versioni ${offer.version}`);
  paragraph(`Për: ${offer.lead.full_name || "Klienti potencial"}${offer.lead.email ? ` · ${offer.lead.email}` : ""}${offer.lead.phone ? ` · ${offer.lead.phone}` : ""}`);

  heading("Njoftim i rëndësishëm");
  paragraph("Ky dokument është propozim shërbimi dhe nuk është marrëveshje aktive. Shërbimet fillojnë vetëm pasi të përfundojnë marrëveshja e kërkuar, miratimet dhe hapat e hyrjes në shërbim.");

  heading("Paketa dhe çmimi");
  const pkg = FOUNDING_PACKAGES[offer.selected_package];
  paragraph(`${pkg?.label || offer.selected_package}: €${(offer.monthly_price_cents / 100).toFixed(2)} në muaj.`);
  paragraph(offer.founding_customer_eligible
    ? `${offer.price_lock_statement || "Çmimi fiksohet për 12 muajt e parë."} Statusi themelues nuk krijon mbështetje të pakufizuar. Pas 12 muajve, rinovimi ndjek çmimin e atëhershëm, përveç nëse bihet dakord ndryshe me shkrim.`
    : "Nuk aplikohet statusi i klientit themelues ose fiksimi 12-mujor i çmimit.");

  heading("Prona, zona dhe shpeshtësia");
  paragraph(offer.property_service_area_summary);
  paragraph(offer.visit_frequency);

  heading("Shërbimet e përfshira");
  paragraph(offer.included_services);

  heading("Përjashtimet dhe kostot e palëve të treta");
  paragraph(offer.exclusions || STANDARD_EXCLUSIONS);
  paragraph("Tarifat e kontraktorëve, pjesët dhe materialet paguhen veçmas, përveç kur përfshihen shprehimisht me shkrim.");

  heading("Kufijtë e miratimit");
  paragraph(`Kufiri normal: €${(offer.normal_approval_limit_cents / 100).toFixed(2)}. Kufiri emergjent: €${(offer.emergency_limit_cents / 100).toFixed(2)}, kur klienti nuk mund të kontaktohet pas përpjekjeve të arsyeshme. Këto kufij nuk autorizojnë ndryshime strukturore, asgjësim të pronës ose punë diskrecionale jo-emergjente pa miratim të qartë.`);

  if (offer.consultation_summary) {
    heading("Përmbledhja e konsultimit");
    paragraph(offer.consultation_summary);
  }
  if (offer.additional_agreed_items) {
    heading("Pika shtesë të dakorduara");
    paragraph(offer.additional_agreed_items);
  }

  heading("Vlefshmëria dhe hapat e ardhshëm");
  paragraph(`Propozimi vlen deri më: ${offer.valid_until || "Nuk është caktuar ende"}. Fillimi i propozuar: ${offer.proposed_start_date || "Për t'u dakorduar"}.`);
  paragraph("Për ta vazhduar: konfirmoni pranimin me shkrim, përfundoni regjistrimin e klientit dhe pronës, pastaj shqyrtoni dhe nënshkruani marrëveshjen e veçantë të shërbimit. Kontakti: Milot Berisha, përmes WhatsApp voice ose video.");

  for (const p of pdf.getPages()) {
    p.drawText(`${offer.offer_number} · Propozim, jo kontratë aktive`, { x: PAGE.marginX, y: 24, size: 8, font: regular, color: rgb(0.45, 0.45, 0.48) });
  }

  return {
    bytes: await pdf.save(),
    filename: `${offer.offer_number.replace(/[^A-Za-z0-9_-]/g, "_")}_sq.pdf`,
  };
}

