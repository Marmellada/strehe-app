import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { termsDocument } from "@/lib/marketing/legal-content";

export const metadata: Metadata = { title: "Terms of Use | STREHË Prona", description: "STREHË Prona terms of use." };
export default function TermsPage() { return <LegalPage document={termsDocument} />; }
