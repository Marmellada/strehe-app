"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  applyPreviewTheme,
  cssColorToPickerValue,
  getInitialPreviewTheme,
  persistPreviewTheme,
  persistPreviousPreviewTheme,
  previewDefaults,
  previewTokenFields,
  readPreviousStoredTheme,
  type PreviewTheme,
} from "./appearance-preview-theme";

type AppearancePreviewPanelProps = {
  scopeLabel?: string;
};

export function AppearancePreviewPanel({
  scopeLabel = "Live app preview",
}: AppearancePreviewPanelProps) {
  const [draftTheme, setDraftTheme] = useState<PreviewTheme>(() =>
    getInitialPreviewTheme()
  );
  const [appliedTheme, setAppliedTheme] = useState<PreviewTheme>(() =>
    getInitialPreviewTheme()
  );
  const [previousAppliedTheme, setPreviousAppliedTheme] =
    useState<PreviewTheme | null>(() => readPreviousStoredTheme());

  useEffect(() => {
    applyPreviewTheme(draftTheme);

    return () => {
      applyPreviewTheme(appliedTheme);
    };
  }, [draftTheme, appliedTheme]);

  const radiusLabel = useMemo(
    () => `${draftTheme.radius}px`,
    [draftTheme.radius]
  );

  const fieldSections = useMemo(() => {
    const grouped = new Map<string, typeof previewTokenFields>();

    previewTokenFields.forEach((field) => {
      const existing = grouped.get(field.section) ?? [];
      existing.push(field);
      grouped.set(field.section, existing);
    });

    return Array.from(grouped.entries());
  }, []);

  const hasUnappliedChanges = JSON.stringify(draftTheme) !== JSON.stringify(appliedTheme);

  function updateDraftTheme(key: keyof PreviewTheme, value: string | number) {
    setDraftTheme((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyChanges() {
    setPreviousAppliedTheme(appliedTheme);
    persistPreviousPreviewTheme(appliedTheme);
    setAppliedTheme(draftTheme);
    persistPreviewTheme(draftTheme);
  }

  function undoLastChange() {
    if (!previousAppliedTheme) return;

    const currentAppliedTheme = appliedTheme;
    setAppliedTheme(previousAppliedTheme);
    setDraftTheme(previousAppliedTheme);
    setPreviousAppliedTheme(currentAppliedTheme);
    persistPreviewTheme(previousAppliedTheme);
    persistPreviousPreviewTheme(currentAppliedTheme);
  }

  function resetTheme() {
    setDraftTheme(previewDefaults);
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            Appearance Controls
          </p>
          <p className="text-sm text-muted-foreground">{scopeLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={undoLastChange}
            disabled={!previousAppliedTheme}
          >
            Undo Last Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTheme}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={applyChanges}
            disabled={!hasUnappliedChanges}
          >
            Apply Changes
          </Button>
        </div>
      </div>

      <div className="border-b px-6 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Default:</span> the
        current light scheme. <span className="font-medium text-foreground">Reset</span>{" "}
        returns the draft to default values.{" "}
        <span className="font-medium text-foreground">Apply Changes</span> makes
        the draft live across the app.{" "}
        <span className="font-medium text-foreground">Undo Last Change</span>{" "}
        returns to the previous applied version.
      </div>

      <div className="grid gap-6 px-6 py-6">
        {fieldSections.map(([section, fields]) => (
          <div key={section} className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {section}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Edit the draft here, review it on this page, then apply it when
                it feels right.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm text-foreground">
                      {field.label}
                    </Label>
                    {field.type === "range" ? (
                      <span className="text-xs text-muted-foreground">
                        {radiusLabel}
                      </span>
                    ) : (
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{
                          backgroundColor: String(draftTheme[field.key]),
                        }}
                      />
                    )}
                  </div>

                  {field.type === "range" ? (
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={draftTheme[field.key]}
                      onChange={(event) =>
                        updateDraftTheme(field.key, Number(event.target.value))
                      }
                      className="w-full accent-foreground"
                    />
                  ) : (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={cssColorToPickerValue(
                          String(draftTheme[field.key])
                        )}
                        onChange={(event) =>
                          updateDraftTheme(field.key, event.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded-md border border-border bg-card p-1"
                      />
                      <Input
                        value={String(draftTheme[field.key])}
                        onChange={(event) =>
                          updateDraftTheme(field.key, event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <Alert>
          <div>
            <div className="mb-1 font-medium">Draft Preview</div>
            <p className="text-sm">
              The values above are a draft preview on this page first. Nothing
              becomes the app-wide applied theme until you press{" "}
              <strong>Apply Changes</strong>.
            </p>
          </div>
        </Alert>
      </div>
    </div>
  );
}
