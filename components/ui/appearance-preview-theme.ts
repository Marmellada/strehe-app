"use client";

export type PreviewTheme = {
  background: string;
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarLabelText: string;
  sidebarLinkText: string;
  sidebarLinkHoverBg: string;
  topbarBg: string;
  topbarText: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonOutlineBg: string;
  buttonOutlineText: string;
  buttonOutlineBorder: string;
  buttonGhostText: string;
  buttonGhostHoverBg: string;
  buttonGhostHoverText: string;
  buttonDestructiveBg: string;
  buttonDestructiveText: string;
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  inputRing: string;
  textareaBg: string;
  textareaText: string;
  textareaBorder: string;
  textareaPlaceholder: string;
  textareaRing: string;
  selectBg: string;
  selectText: string;
  selectBorder: string;
  selectPlaceholder: string;
  selectRing: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableBodyText: string;
  tableRowBorder: string;
  badgeSuccessBg: string;
  badgeSuccessText: string;
  badgeWarningBg: string;
  badgeWarningText: string;
  badgeDangerBg: string;
  badgeDangerText: string;
  badgeInfoBg: string;
  badgeInfoText: string;
  radius: number;
};

type PreviewField =
  | {
      key: keyof PreviewTheme;
      label: string;
      cssVar: string;
      type: "text";
      section: string;
    }
  | {
      key: keyof PreviewTheme;
      label: string;
      cssVar: string;
      type: "range";
      section: string;
      min: number;
      max: number;
      step: number;
      unit: string;
    };

export const APPEARANCE_PREVIEW_STORAGE_KEY = "strehe-ui-preview-theme";
export const APPEARANCE_PREVIEW_PREVIOUS_STORAGE_KEY =
  "strehe-ui-preview-theme-previous";
export const APPEARANCE_PREVIEW_EVENT = "strehe-ui-preview-theme-change";

export const previewDefaults: PreviewTheme = {
  background: "#fafafa",
  foreground: "#171717",
  mutedForeground: "#71717a",
  card: "#ffffff",
  border: "#e4e4e7",
  sidebarBg: "#ffffff",
  sidebarText: "#171717",
  sidebarLabelText: "#71717a",
  sidebarLinkText: "#171717",
  sidebarLinkHoverBg: "#f4f4f5",
  topbarBg: "#ffffff",
  topbarText: "#171717",
  buttonPrimaryBg: "#171717",
  buttonPrimaryText: "#fafafa",
  buttonSecondaryBg: "#f4f4f5",
  buttonSecondaryText: "#171717",
  buttonOutlineBg: "#ffffff",
  buttonOutlineText: "#171717",
  buttonOutlineBorder: "#d4d4d8",
  buttonGhostText: "#171717",
  buttonGhostHoverBg: "#f4f4f5",
  buttonGhostHoverText: "#171717",
  buttonDestructiveBg: "#ef4444",
  buttonDestructiveText: "#ffffff",
  inputBg: "#ffffff",
  inputText: "#171717",
  inputBorder: "#d4d4d8",
  inputPlaceholder: "#71717a",
  inputRing: "#a1a1aa",
  textareaBg: "#f8f8f8",
  textareaText: "#171717",
  textareaBorder: "#d4d4d8",
  textareaPlaceholder: "#71717a",
  textareaRing: "#a1a1aa",
  selectBg: "#f8f8f8",
  selectText: "#171717",
  selectBorder: "#d4d4d8",
  selectPlaceholder: "#71717a",
  selectRing: "#a1a1aa",
  tableHeaderBg: "#f4f4f5",
  tableHeaderText: "#171717",
  tableBodyText: "#171717",
  tableRowBorder: "#e4e4e7",
  badgeSuccessBg: "#dcfce7",
  badgeSuccessText: "#166534",
  badgeWarningBg: "#fef3c7",
  badgeWarningText: "#92400e",
  badgeDangerBg: "#fee2e2",
  badgeDangerText: "#991b1b",
  badgeInfoBg: "#e0f2fe",
  badgeInfoText: "#075985",
  radius: 10,
};

export const previewTokenFields: PreviewField[] = [
  {
    key: "background",
    label: "Page Background",
    cssVar: "--background",
    type: "text",
    section: "Surfaces",
  },
  {
    key: "card",
    label: "Card Background",
    cssVar: "--card",
    type: "text",
    section: "Surfaces",
  },
  {
    key: "border",
    label: "Border Color",
    cssVar: "--border",
    type: "text",
    section: "Surfaces",
  },
  {
    key: "sidebarBg",
    label: "Sidebar Background",
    cssVar: "--sidebar-bg",
    type: "text",
    section: "Sidebar",
  },
  {
    key: "sidebarText",
    label: "Sidebar Base Text",
    cssVar: "--sidebar-text",
    type: "text",
    section: "Sidebar",
  },
  {
    key: "sidebarLabelText",
    label: "Sidebar Section Label",
    cssVar: "--sidebar-label-text",
    type: "text",
    section: "Sidebar",
  },
  {
    key: "sidebarLinkText",
    label: "Sidebar Link Text",
    cssVar: "--sidebar-link-text",
    type: "text",
    section: "Sidebar",
  },
  {
    key: "sidebarLinkHoverBg",
    label: "Sidebar Link Hover Background",
    cssVar: "--sidebar-link-hover-bg",
    type: "text",
    section: "Sidebar",
  },
  {
    key: "topbarBg",
    label: "Topbar Background",
    cssVar: "--topbar-bg",
    type: "text",
    section: "Topbar",
  },
  {
    key: "topbarText",
    label: "Topbar Text",
    cssVar: "--topbar-text",
    type: "text",
    section: "Topbar",
  },
  {
    key: "foreground",
    label: "Primary Text",
    cssVar: "--foreground",
    type: "text",
    section: "Typography",
  },
  {
    key: "mutedForeground",
    label: "Muted Text",
    cssVar: "--muted-foreground",
    type: "text",
    section: "Typography",
  },
  {
    key: "buttonPrimaryBg",
    label: "Primary Button Background",
    cssVar: "--button-primary-bg",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonPrimaryText",
    label: "Primary Button Text",
    cssVar: "--button-primary-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonSecondaryBg",
    label: "Secondary Button Background",
    cssVar: "--button-secondary-bg",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonSecondaryText",
    label: "Secondary Button Text",
    cssVar: "--button-secondary-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonOutlineBg",
    label: "Outline Button Background",
    cssVar: "--button-outline-bg",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonOutlineText",
    label: "Outline Button Text",
    cssVar: "--button-outline-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonOutlineBorder",
    label: "Outline Button Border",
    cssVar: "--button-outline-border",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonGhostText",
    label: "Ghost Button Text",
    cssVar: "--button-ghost-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonGhostHoverBg",
    label: "Ghost Button Hover Background",
    cssVar: "--button-ghost-hover-bg",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonGhostHoverText",
    label: "Ghost Button Hover Text",
    cssVar: "--button-ghost-hover-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonDestructiveBg",
    label: "Destructive Button Background",
    cssVar: "--button-destructive-bg",
    type: "text",
    section: "Buttons",
  },
  {
    key: "buttonDestructiveText",
    label: "Destructive Button Text",
    cssVar: "--button-destructive-text",
    type: "text",
    section: "Buttons",
  },
  {
    key: "inputBg",
    label: "Input Background",
    cssVar: "--input-bg",
    type: "text",
    section: "Input Fields",
  },
  {
    key: "inputText",
    label: "Input Text",
    cssVar: "--input-text",
    type: "text",
    section: "Input Fields",
  },
  {
    key: "inputBorder",
    label: "Input Border",
    cssVar: "--input-border",
    type: "text",
    section: "Input Fields",
  },
  {
    key: "inputPlaceholder",
    label: "Input Placeholder",
    cssVar: "--input-placeholder",
    type: "text",
    section: "Input Fields",
  },
  {
    key: "inputRing",
    label: "Input Focus Ring",
    cssVar: "--input-ring-color",
    type: "text",
    section: "Input Fields",
  },
  {
    key: "textareaBg",
    label: "Textarea Background",
    cssVar: "--textarea-bg",
    type: "text",
    section: "Textarea",
  },
  {
    key: "textareaText",
    label: "Textarea Text",
    cssVar: "--textarea-text",
    type: "text",
    section: "Textarea",
  },
  {
    key: "textareaBorder",
    label: "Textarea Border",
    cssVar: "--textarea-border",
    type: "text",
    section: "Textarea",
  },
  {
    key: "textareaPlaceholder",
    label: "Textarea Placeholder",
    cssVar: "--textarea-placeholder",
    type: "text",
    section: "Textarea",
  },
  {
    key: "textareaRing",
    label: "Textarea Focus Ring",
    cssVar: "--textarea-ring-color",
    type: "text",
    section: "Textarea",
  },
  {
    key: "selectBg",
    label: "Select Background",
    cssVar: "--select-bg",
    type: "text",
    section: "Select Fields",
  },
  {
    key: "selectText",
    label: "Select Text",
    cssVar: "--select-text",
    type: "text",
    section: "Select Fields",
  },
  {
    key: "selectBorder",
    label: "Select Border",
    cssVar: "--select-border",
    type: "text",
    section: "Select Fields",
  },
  {
    key: "selectPlaceholder",
    label: "Select Placeholder",
    cssVar: "--select-placeholder",
    type: "text",
    section: "Select Fields",
  },
  {
    key: "selectRing",
    label: "Select Focus Ring",
    cssVar: "--select-ring-color",
    type: "text",
    section: "Select Fields",
  },
  {
    key: "tableHeaderBg",
    label: "Table Header",
    cssVar: "--table-header-bg",
    type: "text",
    section: "Tables",
  },
  {
    key: "tableHeaderText",
    label: "Table Header Text",
    cssVar: "--table-header-text",
    type: "text",
    section: "Tables",
  },
  {
    key: "tableBodyText",
    label: "Table Body Text",
    cssVar: "--table-body-text",
    type: "text",
    section: "Tables",
  },
  {
    key: "tableRowBorder",
    label: "Table Row Border",
    cssVar: "--table-row-border",
    type: "text",
    section: "Tables",
  },
  {
    key: "badgeSuccessBg",
    label: "Success Badge Fill",
    cssVar: "--badge-success-bg",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeSuccessText",
    label: "Success Badge Text",
    cssVar: "--badge-success-text",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeWarningBg",
    label: "Warning Badge Fill",
    cssVar: "--badge-warning-bg",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeWarningText",
    label: "Warning Badge Text",
    cssVar: "--badge-warning-text",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeDangerBg",
    label: "Danger Badge Fill",
    cssVar: "--badge-danger-bg",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeDangerText",
    label: "Danger Badge Text",
    cssVar: "--badge-danger-text",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeInfoBg",
    label: "Info Badge Fill",
    cssVar: "--badge-info-bg",
    type: "text",
    section: "Badges",
  },
  {
    key: "badgeInfoText",
    label: "Info Badge Text",
    cssVar: "--badge-info-text",
    type: "text",
    section: "Badges",
  },
  {
    key: "radius",
    label: "Shared Radius",
    cssVar: "--radius",
    type: "range",
    section: "Layout",
    min: 6,
    max: 18,
    step: 1,
    unit: "px",
  },
];

export function getPreviewThemeFromDocument(): PreviewTheme {
  if (typeof window === "undefined") return previewDefaults;

  const styles = window.getComputedStyle(document.documentElement);
  const nextTheme = { ...previewDefaults };

  previewTokenFields.forEach((field) => {
    const rawValue = styles.getPropertyValue(field.cssVar).trim();

    if (!rawValue) return;

    if (field.type === "range") {
      const parsed = Number.parseFloat(rawValue.replace("px", ""));
      if (!Number.isNaN(parsed)) {
        nextTheme[field.key] = parsed as never;
      }
      return;
    }

    nextTheme[field.key] = rawValue as never;
  });

  return nextTheme;
}

export function readStoredTheme(): PreviewTheme | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(APPEARANCE_PREVIEW_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PreviewTheme>;
    return {
      ...previewDefaults,
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function readPreviousStoredTheme(): PreviewTheme | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(
    APPEARANCE_PREVIEW_PREVIOUS_STORAGE_KEY
  );
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PreviewTheme>;
    return {
      ...previewDefaults,
      ...parsed,
    };
  } catch {
    return null;
  }
}

export function getInitialPreviewTheme(): PreviewTheme {
  return readStoredTheme() ?? getPreviewThemeFromDocument();
}

export function cssColorToPickerValue(value: string): string {
  if (typeof window === "undefined") return "#000000";

  const sample = document.createElement("span");
  sample.style.color = value;
  sample.style.display = "none";
  document.body.appendChild(sample);

  const computed = window.getComputedStyle(sample).color;
  sample.remove();

  const match = computed.match(/\d+/g);
  if (!match || match.length < 3) {
    return "#000000";
  }

  const [r, g, b] = match.slice(0, 3).map((part) => Number(part));

  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function applyPreviewTheme(theme: PreviewTheme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  previewTokenFields.forEach((field) => {
    const value = theme[field.key];

    if (field.type === "range") {
      root.style.setProperty(field.cssVar, `${value}${field.unit}`);
    } else {
      root.style.setProperty(field.cssVar, String(value));
    }
  });

  root.style.setProperty("--bg", theme.background);
  root.style.setProperty("--surface", theme.card);
  root.style.setProperty("--text", theme.foreground);
  root.style.setProperty("--muted", theme.mutedForeground);
  root.style.setProperty("--link", theme.buttonPrimaryBg);
}

export function clearPreviewTheme() {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  previewTokenFields.forEach((field) => {
    root.style.removeProperty(field.cssVar);
  });

  root.style.removeProperty("--bg");
  root.style.removeProperty("--surface");
  root.style.removeProperty("--text");
  root.style.removeProperty("--muted");
  root.style.removeProperty("--link");
  window.localStorage.removeItem(APPEARANCE_PREVIEW_STORAGE_KEY);
  window.localStorage.removeItem(APPEARANCE_PREVIEW_PREVIOUS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(APPEARANCE_PREVIEW_EVENT));
}

export function persistPreviewTheme(theme: PreviewTheme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPEARANCE_PREVIEW_STORAGE_KEY, JSON.stringify(theme));
  window.dispatchEvent(new CustomEvent(APPEARANCE_PREVIEW_EVENT));
}

export function persistPreviousPreviewTheme(theme: PreviewTheme | null) {
  if (typeof window === "undefined") return;

  if (!theme) {
    window.localStorage.removeItem(APPEARANCE_PREVIEW_PREVIOUS_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    APPEARANCE_PREVIEW_PREVIOUS_STORAGE_KEY,
    JSON.stringify(theme)
  );
}
