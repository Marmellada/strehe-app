"use client";

import { useEffect } from "react";
import {
  applyPreviewTheme,
  normalizePreviewTheme,
  type PreviewTheme,
} from "./appearance-preview-theme";

type AppearanceThemeClientProps = {
  initialTheme?: Partial<PreviewTheme> | null;
};

export function AppearanceThemeClient({
  initialTheme,
}: AppearanceThemeClientProps) {
  useEffect(() => {
    applyPreviewTheme(normalizePreviewTheme(initialTheme));
  }, [initialTheme]);

  return null;
}
