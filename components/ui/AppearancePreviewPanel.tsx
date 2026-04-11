"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  applyPreviewTheme,
  cssColorToPickerValue,
  normalizePreviewTheme,
  previewDefaults,
  previewTokenFields,
  type PreviewTheme,
} from "./appearance-preview-theme";
import { saveGlobalAppearanceTheme } from "@/lib/actions/settings";

type AppearancePreviewPanelProps = {
  scopeLabel?: string;
  initialTheme?: Partial<PreviewTheme> | null;
};

export function AppearancePreviewPanel({
  scopeLabel = "Live app preview",
  initialTheme,
}: AppearancePreviewPanelProps) {
  const sharedTheme = useMemo(
    () => normalizePreviewTheme(initialTheme),
    [initialTheme]
  );
  const [draftTheme, setDraftTheme] = useState<PreviewTheme>(sharedTheme);
  const [appliedTheme, setAppliedTheme] = useState<PreviewTheme>(sharedTheme);
  const [previousAppliedTheme, setPreviousAppliedTheme] =
    useState<PreviewTheme | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  function updateDraftTheme(key: keyof PreviewTheme, value: string | number) {
    setMessage(null);
    setDraftTheme((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function applyChanges() {
    setIsSaving(true);
    setMessage(null);
    const previousTheme = appliedTheme;
    const nextTheme = normalizePreviewTheme(draftTheme);
    const result = await saveGlobalAppearanceTheme(nextTheme);

    setIsSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      applyPreviewTheme(previousTheme);
      setDraftTheme(previousTheme);
      return;
    }

    setPreviousAppliedTheme(previousTheme);
    setAppliedTheme(nextTheme);
    setDraftTheme(nextTheme);
    setMessage({
      type: "success",
      text: "Shared appearance saved. Everyone will pick up this default on refresh.",
    });
  }

  async function undoLastChange() {
    if (!previousAppliedTheme) return;

    setIsSaving(true);
    setMessage(null);

    const currentAppliedTheme = appliedTheme;
    const result = await saveGlobalAppearanceTheme(previousAppliedTheme);

    setIsSaving(false);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
      applyPreviewTheme(currentAppliedTheme);
      return;
    }

    setAppliedTheme(previousAppliedTheme);
    setDraftTheme(previousAppliedTheme);
    setPreviousAppliedTheme(currentAppliedTheme);
    setMessage({
      type: "success",
      text: "Shared appearance reverted to the previous saved version.",
    });
  }

  function resetTheme() {
    setMessage(null);
    setDraftTheme(previewDefaults);
  }

  const hasUnappliedChanges =
    JSON.stringify(draftTheme) !== JSON.stringify(appliedTheme);

  const buttonLabel = isSaving
    ? "Saving..."
    : hasUnappliedChanges
      ? "Save For Everyone"
      : "Saved";

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
            disabled={!previousAppliedTheme || isSaving}
          >
            Undo Last Change
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetTheme}
            disabled={isSaving}
          >
            Reset Draft
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={applyChanges}
            disabled={!hasUnappliedChanges || isSaving}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>

      <div className="border-b px-6 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Default:</span> the
        current company-wide appearance.{" "}
        <span className="font-medium text-foreground">Reset Draft</span> returns
        the editor to the built-in fallback values.{" "}
        <span className="font-medium text-foreground">Save For Everyone</span>{" "}
        updates the shared default saved in the database.{" "}
        <span className="font-medium text-foreground">Undo Last Change</span>{" "}
        restores the previous saved version.
      </div>

      {message ? (
        <div className="px-6 pt-6">
          <Alert variant={message.type === "error" ? "destructive" : "success"}>
            <div className="text-sm">{message.text}</div>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 px-6 py-6">
        {fieldSections.map(([section, fields]) => (
          <div key={section} className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {section}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Edit the draft here, review it on this page, then save it when
                it feels right for the whole app.
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
              The values above are still a draft on this page first. Nothing
              becomes the shared default until you press{" "}
              <strong>Save For Everyone</strong>.
            </p>
          </div>
        </Alert>
      </div>
    </div>
  );
}
