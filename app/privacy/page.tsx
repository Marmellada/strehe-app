import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { privacyDocument } from "@/lib/marketing/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy | STREHË Prona",
  description: "STREHË Prona privacy policy.",
  alternates: { canonical: "https://www.streheprona.com/privacy" },
};
export default function PrivacyPage() { return <LegalPage document={privacyDocument} />; }
