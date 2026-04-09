"use client";

import { useEffect } from "react";
import {
  APPEARANCE_PREVIEW_EVENT,
  applyPreviewTheme,
  readStoredTheme,
} from "./appearance-preview-theme";

export function AppearanceThemeClient() {
  useEffect(() => {
    function applyStoredTheme() {
      const storedTheme = readStoredTheme();

      if (storedTheme) {
        applyPreviewTheme(storedTheme);
      }
    }

    applyStoredTheme();
    window.addEventListener(APPEARANCE_PREVIEW_EVENT, applyStoredTheme);
    window.addEventListener("storage", applyStoredTheme);

    return () => {
      window.removeEventListener(APPEARANCE_PREVIEW_EVENT, applyStoredTheme);
      window.removeEventListener("storage", applyStoredTheme);
    };
  }, []);

  return null;
}
