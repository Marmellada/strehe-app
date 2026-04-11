import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { UiPreviewClient } from "./ui-preview-client";
import {
  normalizePreviewTheme,
  type PreviewTheme,
} from "@/components/ui/appearance-preview-theme";

export const metadata = {
  title: "UI Preview - STREHE Admin",
  description: "Internal preview of standardized UI primitives and global appearance controls.",
};

export default async function UiPreviewPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("appearance_theme")
    .limit(1)
    .maybeSingle();
  const initialTheme = normalizePreviewTheme(
    (companySettings?.appearance_theme as Partial<PreviewTheme> | null | undefined) ??
      null
  );

  return <UiPreviewClient initialTheme={initialTheme} />;
}
