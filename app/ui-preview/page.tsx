import { requireRole } from "@/lib/auth/require-role";
import { UiPreviewClient } from "./ui-preview-client";

export const metadata = {
  title: "UI Preview - STREHE Admin",
  description: "Internal preview of standardized UI primitives and global appearance controls.",
};

export default async function UiPreviewPage() {
  await requireRole(["admin"]);

  return <UiPreviewClient />;
}
