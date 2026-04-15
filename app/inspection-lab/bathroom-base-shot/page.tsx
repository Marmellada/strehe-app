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
  listBathroomCases,
  INSPECTION_STORAGE_BUCKET,
  type InspectionLabCasePhotoRow,
  type InspectionRoomType,
} from "@/lib/inspection-lab/bathroom-base-shot";
import {
  runBathroomCaseAction,
  updateBathroomPhotoMetadataAction,
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

async function updateBathroomPhotoMetadataFormAction(
  formData: FormData
): Promise<void> {
  "use server";

  const result = await updateBathroomPhotoMetadataAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

async function runBathroomCaseFormAction(formData: FormData): Promise<void> {
  "use server";

  const result = await runBathroomCaseAction(formData);

  if (!result.ok) {
    throw new Error(result.error);
  }
}

export default async function BathroomBaseShotLabPage() {
  await requireRole(["admin", "office", "field", "contractor"]);
  const supabase = getAdminClient();

  const [{ data: caseRows, error: casesError }, { data: photoRows, error: photosError }] =
    await Promise.all([
      supabase.from("inspection_lab_cases").select("*").order("case_key"),
      supabase.from("inspection_lab_case_photos").select("*"),
    ]);

  if (casesError) {
    throw new Error(`Failed to load inspection lab cases: ${casesError.message}`);
  }

  if (photosError) {
    throw new Error(`Failed to load inspection lab photos: ${photosError.message}`);
  }

  const cases = await listBathroomCases(
    caseRows || [],
    (photoRows || []) as InspectionLabCasePhotoRow[],
    supabase.storage.from(INSPECTION_STORAGE_BUCKET)
  );

  const readyCases = cases.filter((item) => item.baselineExists && item.currentExists);
  const reviewCases = cases.filter((item) => item.findings?.reviewRequired).length;
  const trackedTargetsCount = cases.reduce(
    (total, item) => total + item.trackedTargets.length,
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
        <StatCard title="Tracked Targets" value={trackedTargetsCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px),1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Ordered Capture</CardTitle>
            <CardDescription>
              Use one upload per order position. For living room, a good starting set is: 1 wide,
              2 sofa, 3 coffee_table, 4 tv, 5 shelf or decor.
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
              This is your daily testing surface: capture coverage, tracked targets, findings, and
              report text.
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
                                      <Button asChild variant="outline" size="sm">
                                        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                                          View
                                        </a>
                                      </Button>
                                    ) : null}
                                  </div>

                                  <form action={updateBathroomPhotoMetadataFormAction} className="space-y-3">
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

                                  <form action={updateBathroomPhotoMetadataFormAction} className="space-y-3">
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
                        <div className="mb-2 text-sm font-medium">Tracked From Baseline</div>

                        {item.trackedTargets.length ? (
                          <ul className="space-y-2 text-sm">
                            {item.trackedTargets.map((target) => (
                              <li
                                key={`${item.id}-${target.key}`}
                                className="rounded-lg border border-border/60 px-3 py-2"
                              >
                                <div className="font-medium">
                                  {target.label.replace(/_/g, " ")}
                                </div>
                                <div className="text-muted-foreground">
                                  {target.status} · {target.importance} · {target.reason}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Nothing explicit has been extracted yet. Run the engine after baseline
                            and current sets are complete.
                          </div>
                        )}
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

                      <form action={runBathroomCaseFormAction}>
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