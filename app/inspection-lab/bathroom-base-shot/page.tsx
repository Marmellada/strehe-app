import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  listInspectionCases,
  INSPECTION_STORAGE_BUCKET,
  type InspectionLabCasePhotoRow,
  type InspectionLabTrackedObjectRow,
  type InspectionRoomType,
} from "@/lib/inspection-lab/bathroom-base-shot";
import {
  runInspectionCaseAction,
  saveInspectionTrackedObjectAction,
  toggleInspectionTrackedObjectAction,
  updateInspectionPhotoMetadataAction,
} from "@/app/inspection-lab/bathroom-base-shot/actions";
import { RoomStateUploadForm } from "@/components/inspection-lab/RoomStateUploadForm";

const PHOTO_TYPE_OPTIONS: Record<InspectionRoomType, readonly string[]> = {
  bathroom: [
    "wide",
    "entrance",
    "sink",
    "toilet",
    "mirror",
    "shower",
    "bathtub",
    "cabinet",
    "shelf",
    "trash_bin",
    "soap_dispenser",
    "decor",
    "plant",
    "other",
  ],
  living_room: [
    "wide",
    "entrance",
    "sofa",
    "coffee_table",
    "tv",
    "tv_stand",
    "armchair",
    "side_table",
    "lamp",
    "rug",
    "shelf",
    "cabinet",
    "wall_art",
    "mirror",
    "plant",
    "decor",
    "other",
  ],
};

const TRACKED_OBJECT_CATEGORY_OPTIONS = [
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

const TRACKED_OBJECT_LABEL_SUGGESTIONS: Record<InspectionRoomType, readonly string[]> = {
  bathroom: [
    "sink",
    "mirror",
    "toilet",
    "shower fixture",
    "bathtub",
    "cabinet",
    "wall light",
    "special mirror",
    "collectible decor",
  ],
  living_room: [
    "sofa",
    "tv",
    "tv stand",
    "coffee table",
    "armchair",
    "painting",
    "floor lamp",
    "wall mirror",
    "bronze figurine",
  ],
};

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "ready":
      return "success" as const;
    case "review_required":
      return "warning" as const;
    case "completed":
      return "info" as const;
    case "draft":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function formatStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRoomTypeLabel(roomType: InspectionRoomType) {
  return roomType.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatOptionLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

async function updateInspectionPhotoMetadataFormAction(
  formData: FormData
): Promise<void> {
  "use server";

  const result = await updateInspectionPhotoMetadataAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function runInspectionCaseFormAction(formData: FormData): Promise<void> {
  "use server";

  const result = await runInspectionCaseAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function saveInspectionTrackedObjectFormAction(
  formData: FormData
): Promise<void> {
  "use server";

  const result = await saveInspectionTrackedObjectAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function toggleInspectionTrackedObjectFormAction(
  formData: FormData
): Promise<void> {
  "use server";

  const result = await toggleInspectionTrackedObjectAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

export default async function RoomStateInspectionLabPage() {
  await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();

  const [
    { data: caseRows, error: casesError },
    { data: photoRows, error: photosError },
    { data: trackedObjectRows, error: trackedObjectsError },
  ] =
    await Promise.all([
      supabase.from("inspection_lab_cases").select("*").order("case_key"),
      supabase.from("inspection_lab_case_photos").select("*"),
      supabase.from("inspection_lab_tracked_objects").select("*"),
    ]);

  if (casesError) {
    throw new Error(`Failed to load inspection lab cases: ${casesError.message}`);
  }

  if (photosError) {
    throw new Error(`Failed to load inspection lab photos: ${photosError.message}`);
  }

  if (trackedObjectsError) {
    throw new Error(
      `Failed to load inspection tracked objects: ${trackedObjectsError.message}`
    );
  }

  const cases = await listInspectionCases(
    caseRows || [],
    (photoRows || []) as InspectionLabCasePhotoRow[],
    (trackedObjectRows || []) as InspectionLabTrackedObjectRow[],
    supabase.storage.from(INSPECTION_STORAGE_BUCKET)
  );

  const readyCases = cases.filter((item) => item.baselineExists && item.currentExists);
  const reviewCases = cases.filter((item) => item.findings?.reviewRequired).length;
  const trackedTargetsCount = cases.reduce(
    (total, item) =>
      total + item.trackedTargets.filter((trackedObject) => trackedObject.activityStatus === "active").length,
    0
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Room State Lab"
        description="Use the main inspection lab to refine ordered baseline and current capture sets for bathroom or living room cases."
      />

      <Alert variant="info">
        <AlertTitle>Main lab, now with direct Supabase upload</AlertTitle>
        <AlertDescription>
          Photos upload directly from the phone browser to Supabase Storage. Metadata and reports are
          still handled inside the app.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Cases" value={cases.length} />
        <StatCard title="Ready To Compare" value={readyCases.length} />
        <StatCard title="Review Flags" value={reviewCases} />
        <StatCard title="Tracked Objects" value={trackedTargetsCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px),1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Ordered Capture</CardTitle>
            <CardDescription>
              Use one upload per order position. For living room, a good starting set is: 1 wide,
              2 sofa, 3 coffee_table, 4 tv, 5 tv_stand or armchair.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomStateUploadForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case Results</CardTitle>
            <CardDescription>
              This is your daily testing surface: capture coverage, high-confidence tracked objects,
              findings, and report text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cases.length === 0 ? (
              <EmptyState
                title="No room cases yet"
                description="Upload a baseline photo set to create the first inspection lab case."
              />
            ) : (
              <div className="space-y-4">
                {cases.map((item) => (
                  <Card key={item.id} size="sm" className="border border-border/70">
                    <CardHeader className="gap-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>{item.caseId}</CardTitle>
                          <CardDescription>
                            {formatRoomTypeLabel(item.roomType)} ordered capture case
                          </CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(item.reportStatus)}>
                          {formatStatusLabel(item.reportStatus)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Baseline Set</div>
                            <Badge variant={item.baselineExists ? "success" : "neutral"}>
                              {item.baselinePhotos.length} photo
                              {item.baselinePhotos.length === 1 ? "" : "s"}
                            </Badge>
                          </div>

                          {item.baselinePhotos.length ? (
                            <div className="space-y-3">
                              {item.baselinePhotos.map((photo) => (
                                <div key={photo.id} className="rounded-lg border border-border/60 p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">
                                      #{photo.orderIndex ?? "?"} {photo.photoType || "unspecified"}
                                    </div>
                                    {photo.signedUrl ? (
                                      <div className="flex gap-2">
                                        <Button asChild variant="outline" size="sm">
                                          <a href={`/inspection-lab/bathroom-base-shot/photos/${photo.id}`}>
                                            Review
                                          </a>
                                        </Button>
                                        <Button asChild variant="outline" size="sm">
                                          <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                                            View
                                          </a>
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>

                                  <form action={updateInspectionPhotoMetadataFormAction} className="space-y-3">
                                    <input type="hidden" name="photo_id" value={photo.id} />
                                    <input type="hidden" name="case_row_id" value={item.id} />

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label
                                          htmlFor={`photo_type_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Photo Type
                                        </label>
                                        <select
                                          id={`photo_type_${photo.id}`}
                                          name="photo_type"
                                          className="input w-full"
                                          defaultValue={photo.photoType || "wide"}
                                        >
                                          {PHOTO_TYPE_OPTIONS[item.roomType].map((value) => (
                                            <option key={value} value={value}>
                                              {value
                                                .replace(/_/g, " ")
                                                .replace(/\b\w/g, (char) => char.toUpperCase())}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label
                                          htmlFor={`order_index_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Order
                                        </label>
                                        <Input
                                          id={`order_index_${photo.id}`}
                                          name="order_index"
                                          type="number"
                                          min={1}
                                          step={1}
                                          defaultValue={photo.orderIndex ?? 1}
                                          required
                                        />
                                      </div>
                                    </div>

                                    <Button type="submit" variant="outline" size="sm">
                                      Save Metadata
                                    </Button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No baseline photos yet.</div>
                          )}
                        </div>

                        <div className="rounded-lg border border-border/70 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="font-medium">Current Set</div>
                            <Badge variant={item.currentExists ? "success" : "neutral"}>
                              {item.currentPhotos.length} photo
                              {item.currentPhotos.length === 1 ? "" : "s"}
                            </Badge>
                          </div>

                          {item.currentPhotos.length ? (
                            <div className="space-y-3">
                              {item.currentPhotos.map((photo) => (
                                <div key={photo.id} className="rounded-lg border border-border/60 p-3">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-sm font-medium">
                                      #{photo.orderIndex ?? "?"} {photo.photoType || "unspecified"}
                                    </div>
                                    {photo.signedUrl ? (
                                      <Button asChild variant="outline" size="sm">
                                        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                                          View
                                        </a>
                                      </Button>
                                    ) : null}
                                  </div>

                                  <form action={updateInspectionPhotoMetadataFormAction} className="space-y-3">
                                    <input type="hidden" name="photo_id" value={photo.id} />
                                    <input type="hidden" name="case_row_id" value={item.id} />

                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label
                                          htmlFor={`photo_type_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Photo Type
                                        </label>
                                        <select
                                          id={`photo_type_${photo.id}`}
                                          name="photo_type"
                                          className="input w-full"
                                          defaultValue={photo.photoType || "wide"}
                                        >
                                          {PHOTO_TYPE_OPTIONS[item.roomType].map((value) => (
                                            <option key={value} value={value}>
                                              {value
                                                .replace(/_/g, " ")
                                                .replace(/\b\w/g, (char) => char.toUpperCase())}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label
                                          htmlFor={`order_index_${photo.id}`}
                                          className="mb-1 block text-sm font-medium"
                                        >
                                          Order
                                        </label>
                                        <Input
                                          id={`order_index_${photo.id}`}
                                          name="order_index"
                                          type="number"
                                          min={1}
                                          step={1}
                                          defaultValue={photo.orderIndex ?? 1}
                                          required
                                        />
                                      </div>
                                    </div>

                                    <Button type="submit" variant="outline" size="sm">
                                      Save Metadata
                                    </Button>
                                  </form>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No current photos yet.</div>
                          )}
                        </div>
                      </div>

                      {item.findings ? (
                        <div className="grid gap-3 rounded-lg border border-border/70 p-3 sm:grid-cols-3">
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Same Room</div>
                            <div className="font-medium">
                              {formatStatusLabel(item.findings.sameRoomVerdict)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Change</div>
                            <div className="font-medium">
                              {formatStatusLabel(item.findings.changeSeverity)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase text-muted-foreground">Flags</div>
                            <div className="font-medium">{item.findings.findingCount}</div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 text-sm font-medium">High-Confidence Tracked From Baseline</div>

                        {item.trackedTargets.length ? (
                          <ul className="space-y-2 text-sm">
                            {item.trackedTargets.map((target) => (
                              <li
                                key={`${item.id}-${target.key}`}
                                className="rounded-lg border border-border/60 px-3 py-2"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <div className="font-medium">
                                      {target.label.replace(/_/g, " ")}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {target.status} · {target.importance} ·{" "}
                                      {target.activityStatus}
                                      {target.category ? ` · ${target.category}` : ""} ·{" "}
                                      {target.reason}
                                      {target.baselineOrderIndex
                                        ? ` · baseline photo #${target.baselineOrderIndex}`
                                        : ""}
                                    </div>
                                  </div>

                                  <form action={toggleInspectionTrackedObjectFormAction}>
                                    <input type="hidden" name="case_row_id" value={item.id} />
                                    <input type="hidden" name="object_key" value={target.key} />
                                    <input
                                      type="hidden"
                                      name="next_status"
                                      value={
                                        target.activityStatus === "active" ? "inactive" : "active"
                                      }
                                    />
                                    <Button type="submit" variant="outline" size="sm">
                                      {target.activityStatus === "active"
                                        ? "Set Inactive"
                                        : "Set Active"}
                                    </Button>
                                  </form>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Nothing high-confidence has been extracted yet. Run the engine after
                            baseline and current sets are complete.
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 text-sm font-medium">Add Manual Tracked Object</div>
                        <p className="mb-3 text-sm text-muted-foreground">
                          Use this when the engine missed something important like a figurine,
                          painting, collectible, or special fixture. This saves the object as part
                          of the case baseline review.
                        </p>

                        <div className="mb-3 flex flex-wrap gap-2">
                          {TRACKED_OBJECT_LABEL_SUGGESTIONS[item.roomType].map((label) => (
                            <Badge key={`${item.id}-${label}`} variant="neutral">
                              {formatOptionLabel(label)}
                            </Badge>
                          ))}
                        </div>

                        <form
                          action={saveInspectionTrackedObjectFormAction}
                          className="space-y-3"
                        >
                          <input type="hidden" name="case_row_id" value={item.id} />
                          <input type="hidden" name="source" value="manual_added" />

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`tracked_label_${item.id}`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Object Label
                              </label>
                              <Input
                                id={`tracked_label_${item.id}`}
                                name="label"
                                list={`tracked_label_suggestions_${item.id}`}
                                placeholder="e.g., bronze figurine"
                                required
                              />
                              <datalist id={`tracked_label_suggestions_${item.id}`}>
                                {TRACKED_OBJECT_LABEL_SUGGESTIONS[item.roomType].map((label) => (
                                  <option key={`${item.id}-label-${label}`} value={label} />
                                ))}
                              </datalist>
                            </div>

                            <div>
                              <label
                                htmlFor={`tracked_category_${item.id}`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Category
                              </label>
                              <select
                                id={`tracked_category_${item.id}`}
                                name="category"
                                className="input w-full"
                                defaultValue=""
                              >
                                <option value="">Choose category</option>
                                {TRACKED_OBJECT_CATEGORY_OPTIONS.map((category) => (
                                  <option key={`${item.id}-category-${category}`} value={category}>
                                    {formatOptionLabel(category)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`tracked_importance_${item.id}`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Importance
                              </label>
                              <select
                                id={`tracked_importance_${item.id}`}
                                name="importance"
                                className="input w-full"
                                defaultValue="high"
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                              </select>
                            </div>

                            <div>
                              <label
                                htmlFor={`tracked_baseline_photo_${item.id}`}
                                className="mb-1 block text-sm font-medium"
                              >
                                Baseline Photo
                              </label>
                              <select
                                id={`tracked_baseline_photo_${item.id}`}
                                name="baseline_photo_id"
                                className="input w-full"
                                defaultValue={item.baselinePhotos[0]?.id ?? ""}
                              >
                                <option value="">No specific photo yet</option>
                                {item.baselinePhotos.map((photo) => (
                                  <option key={photo.id} value={photo.id}>
                                    #{photo.orderIndex ?? "?"} {photo.photoType || "unspecified"}
                                  </option>
                                ))}
                              </select>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Link the object to the baseline photo where it is easiest to see.
                              </p>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`tracked_review_note_${item.id}`}
                              className="mb-1 block text-sm font-medium"
                            >
                              Review Note
                            </label>
                            <Input
                              id={`tracked_review_note_${item.id}`}
                              name="review_note"
                              placeholder="Why this object matters or how to recognize it"
                            />
                          </div>

                          <Button type="submit" variant="outline">
                            Save Manual Object
                          </Button>
                        </form>
                      </div>

                      {item.findings?.highlights?.length ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Top findings</div>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            {item.findings.highlights.map((highlight, index) => (
                              <li
                                key={`${item.id}-highlight-${index}`}
                                className="rounded-lg border border-border/60 px-3 py-2"
                              >
                                {highlight}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {item.reportMarkdown ? (
                        <div className="space-y-2 rounded-lg border border-border/70 p-3">
                          <div className="text-sm font-medium">Narrative report</div>
                          <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {item.reportMarkdown}
                          </pre>
                        </div>
                      ) : (
                        <Alert variant="info">
                          <AlertTitle>Engine not run yet</AlertTitle>
                          <AlertDescription>
                            Upload at least one ordered baseline photo and one ordered current photo,
                            then run the engine.
                          </AlertDescription>
                        </Alert>
                      )}

                      <form action={runInspectionCaseFormAction}>
                        <input type="hidden" name="case_id" value={item.caseId} />
                        <Button
                          type="submit"
                          className="w-full sm:w-auto"
                          disabled={!item.baselineExists || !item.currentExists}
                        >
                          Run Engine
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
