import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { deletionDocument } from "@/lib/marketing/legal-content";

export const metadata: Metadata = { title: "Data Deletion Instructions | STREHË Prona", description: "How to request deletion of personal information held by STREHË Prona." };
export default function DataDeletionPage() { return <LegalPage document={deletionDocument} />; }
