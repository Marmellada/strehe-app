"use client";

import { useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";
import type { InspectionTrackedObject } from "@/lib/inspection-lab/bathroom-base-shot";

const CATEGORY_OPTIONS = [
  "fixture",
  "furniture",
  "appliance",
  "lighting",
  "wall_art",
  "mirror",
  "electronics",
  "decor",
  "collectible",
  "storage",
  "other",
] as const;

const LABEL_SUGGESTIONS = [
  "sofa",
  "tv",
  "tv stand",
  "coffee table",
  "armchair",
  "painting",
  "wall mirror",
  "floor lamp",
  "bronze figurine",
  "special fixture",
] as const;

function formatOptionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type Props = {
  caseRowId: string;
  photoId: string;
  photoLabel: string;
  signedUrl: string;
  trackedObjects: InspectionTrackedObject[];
  saveTrackedObjectAction: (formData: FormData) => Promise<void>;
  saveMarkerAction: (formData: FormData) => Promise<void>;
};

export function PhotoObjectReview({
  caseRowId,
  photoId,
  photoLabel,
  signedUrl,
  trackedObjects,
  saveTrackedObjectAction,
  saveMarkerAction,
}: Props) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string>("");
  const [draftPoint, setDraftPoint] = useState<{ x: number; y: number } | null>(null);
  const engineSeededObjects = trackedObjects.filter(
    (item) => item.source === "auto_detected" || item.source === "engine" || item.source === "baseline_capture"
  );
  const manualObjects = trackedObjects.filter(
    (item) => item.source === "manual_added" || item.source === "manual_corrected"
  );

  function handleImageClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = imageRef.current;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = Number(((event.clientX - rect.left) / rect.width).toFixed(4));
    const y = Number(((event.clientY - rect.top) / rect.height).toFixed(4));

    setDraftPoint({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),360px]">
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium">{photoLabel}</div>
          <div className="text-sm text-muted-foreground">
            Click the photo to place or update a marker for the selected object.
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-lg border border-border/70 bg-black/5"
          onClick={handleImageClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={signedUrl}
            alt={photoLabel}
            className="block h-auto w-full"
          />

          {trackedObjects.map((item) =>
            item.markerX !== null && item.markerY !== null ? (
              <button
                key={item.id || item.key}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.id) {
                    setSelectedObjectId(item.id);
                  }
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 px-2 py-1 text-xs font-medium shadow ${
                  selectedObjectId === item.id
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-white bg-black/80 text-white"
                }`}
                style={{
                  left: `${item.markerX * 100}%`,
                  top: `${item.markerY * 100}%`,
                }}
              >
                {item.label}
              </button>
            ) : null
          )}

          {draftPoint ? (
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-500 bg-sky-500/60"
              style={{
                left: `${draftPoint.x * 100}%`,
                top: `${draftPoint.y * 100}%`,
              }}
            />
          ) : null}
        </div>

        <div className="text-sm text-muted-foreground">
          {draftPoint
            ? `Draft marker: x ${draftPoint.x.toFixed(3)}, y ${draftPoint.y.toFixed(3)}`
            : "Click on the image to create a draft marker."}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-border/70 p-3">
          <div className="mb-2 text-sm font-medium">Engine Seeded Candidates</div>
          {engineSeededObjects.length ? (
            <ul className="space-y-2">
              {engineSeededObjects.map((item) => (
                <li key={item.id || item.key} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.category || "uncategorized"} · {item.activityStatus} · {item.source}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.reason}</div>
                    </div>
                    <Badge variant={item.markerX !== null && item.markerY !== null ? "success" : "neutral"}>
                      {item.markerX !== null && item.markerY !== null ? "Placed" : "Needs Marker"}
                    </Badge>
                  </div>

                  {item.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedObjectId === item.id ? "default" : "outline"}
                        onClick={() => setSelectedObjectId(item.id || "")}
                      >
                        {selectedObjectId === item.id ? "Selected" : "Select"}
                      </Button>

                      <form action={saveMarkerAction}>
                        <input type="hidden" name="tracked_object_id" value={item.id} />
                        <input type="hidden" name="baseline_photo_id" value={photoId} />
                        <input
                          type="hidden"
                          name="marker_x"
                          value={selectedObjectId === item.id && draftPoint ? String(draftPoint.x) : ""}
                        />
                        <input
                          type="hidden"
                          name="marker_y"
                          value={selectedObjectId === item.id && draftPoint ? String(draftPoint.y) : ""}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={selectedObjectId !== item.id || !draftPoint}
                        >
                          Save Marker
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">
              The engine did not surface any candidates for this photo yet. If this image clearly
              contains a major object like a TV or sofa, that means the auto-seed step needs
              attention rather than you missing something.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/70 p-3">
          <div className="mb-2 text-sm font-medium">Manual Objects On This Photo</div>
          {manualObjects.length ? (
            <ul className="space-y-2">
              {manualObjects.map((item) => (
                <li key={item.id || item.key} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{item.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.category || "uncategorized"} · {item.activityStatus} · {item.source}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.reason}</div>
                    </div>
                    <Badge variant={item.markerX !== null && item.markerY !== null ? "success" : "neutral"}>
                      {item.markerX !== null && item.markerY !== null ? "Placed" : "Needs Marker"}
                    </Badge>
                  </div>

                  {item.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedObjectId === item.id ? "default" : "outline"}
                        onClick={() => setSelectedObjectId(item.id || "")}
                      >
                        {selectedObjectId === item.id ? "Selected" : "Select"}
                      </Button>

                      <form action={saveMarkerAction}>
                        <input type="hidden" name="tracked_object_id" value={item.id} />
                        <input type="hidden" name="baseline_photo_id" value={photoId} />
                        <input
                          type="hidden"
                          name="marker_x"
                          value={selectedObjectId === item.id && draftPoint ? String(draftPoint.x) : ""}
                        />
                        <input
                          type="hidden"
                          name="marker_y"
                          value={selectedObjectId === item.id && draftPoint ? String(draftPoint.y) : ""}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={selectedObjectId !== item.id || !draftPoint}
                        >
                          Save Marker
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">
              No manual objects have been added for this photo yet.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/70 p-3">
          <div className="mb-2 text-sm font-medium">Add Object From This Photo</div>
          <p className="mb-3 text-sm text-muted-foreground">
            Click the image first if you want the new object to be created with a marker already in
            place.
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            {LABEL_SUGGESTIONS.map((label) => (
              <Badge key={label} variant="neutral">
                {formatOptionLabel(label)}
              </Badge>
            ))}
          </div>

          <form action={saveTrackedObjectAction} className="space-y-3">
            <input type="hidden" name="case_row_id" value={caseRowId} />
            <input type="hidden" name="source" value="manual_added" />
            <input type="hidden" name="baseline_photo_id" value={photoId} />
            <input type="hidden" name="marker_x" value={draftPoint ? String(draftPoint.x) : ""} />
            <input type="hidden" name="marker_y" value={draftPoint ? String(draftPoint.y) : ""} />

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="manual_label">
                Object Label
              </label>
              <Input
                id="manual_label"
                name="label"
                list="manual_label_suggestions"
                placeholder="e.g., bronze figurine"
                required
              />
              <datalist id="manual_label_suggestions">
                {LABEL_SUGGESTIONS.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="manual_category">
                Category
              </label>
              <select id="manual_category" name="category" className="input w-full" defaultValue="">
                <option value="">Choose category</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {formatOptionLabel(category)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="manual_importance">
                  Importance
                </label>
                <select
                  id="manual_importance"
                  name="importance"
                  className="input w-full"
                  defaultValue="high"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="manual_note">
                  Review Note
                </label>
                <Input
                  id="manual_note"
                  name="review_note"
                  placeholder="How to recognize it or why it matters"
                />
              </div>
            </div>

            <Button type="submit" variant="outline">
              Save Object On This Photo
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
