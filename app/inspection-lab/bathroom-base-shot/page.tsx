import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
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
  FormField,
  Input,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";
import { requireRole } from "@/lib/auth/require-role";
import {
  type BathroomCaptureSlot,
  ensureCaseManifest,
  listBathroomCases,
  normalizeCaseId,
} from "@/lib/inspection-lab/bathroom-base-shot";

const execFileAsync = promisify(execFile);

function isAllowedImageType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(
    mimeType
  );
}

async function uploadBathroomBaseShot(formData: FormData) {
  "use server";

  await requireRole(["admin", "office", "field", "contractor"]);

  const rawCaseId = String(formData.get("case_id") || "").trim();
  const slot = String(formData.get("slot") || "").trim() as BathroomCaptureSlot;
  const file = formData.get("photo");

  if (!rawCaseId) {
    throw new Error("Case ID is required.");
  }

  if (slot !== "baseline" && slot !== "current") {
    throw new Error("Capture slot must be baseline or current.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please choose a photo to upload.");
  }

  if (!isAllowedImageType(file.type)) {
    throw new Error("Only JPG, PNG, and WEBP images are allowed.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Photo exceeds the 12 MB limit.");
  }

  const { caseDir } = await ensureCaseManifest(rawCaseId);
  const targetPath = path.join(caseDir, `${slot}.jpg`);
  const bytes = await file.arrayBuffer();

  await fs.writeFile(targetPath, Buffer.from(bytes));
  revalidatePath("/inspection-lab/bathroom-base-shot");
}

async function runBathroomCase(formData: FormData) {
  "use server";

  await requireRole(["admin", "office", "field", "contractor"]);
  const rawCaseId = String(formData.get("case_id") || "").trim();

  if (!rawCaseId) {
    throw new Error("Case ID is required.");
  }

  const caseId = normalizeCaseId(rawCaseId);
  const manifestPath = path.join(
    process.cwd(),
    "inspection-lab",
    "bathroom-base-shot",
    "cases",
    caseId,
    "manifest.json"
  );

  await execFileAsync(process.execPath, [
    "scripts/run-bathroom-base-shot-engine.mjs",
    manifestPath,
  ], {
    cwd: process.cwd(),
  });

  revalidatePath("/inspection-lab/bathroom-base-shot");
}

export default async function BathroomBaseShotLabPage() {
  await requireRole(["admin", "office", "field", "contractor"]);

  const cases = await listBathroomCases();
  const readyCases = cases.filter((item) => item.baselineExists && item.currentExists);
  const reviewCases = cases.filter((item) => item.findings?.reviewRequired).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Bathroom Base-Shot Lab"
        description="Phone-friendly local capture page for the bathroom inspection prototype. Upload one baseline shot and one current shot, then run the comparison engine."
      />

      <Alert variant="warning">
        <AlertTitle>Local lab workflow</AlertTitle>
        <AlertDescription>
          This is an experimental capture surface for local testing. It writes images into the repo
          lab folders and runs the bathroom comparison engine from there.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Cases" value={cases.length} />
        <StatCard title="Ready To Compare" value={readyCases.length} />
        <StatCard title="Review Flags" value={reviewCases} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px),1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Capture Upload</CardTitle>
            <CardDescription>
              Create or reuse a case ID, choose whether this is the baseline or current photo, then
              upload directly from your phone camera or gallery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadBathroomBaseShot} className="space-y-4">
              <FormField
                id="case_id"
                label="Case ID"
                required
                hint="Use a stable name like apartment-12-bathroom or bathroom-test-001."
              >
                <Input
                  id="case_id"
                  name="case_id"
                  placeholder="e.g., apartment-12-bathroom"
                  required
                />
              </FormField>

              <FormField
                id="slot"
                label="Photo Type"
                required
                hint="Baseline is your reference photo. Current is the newer comparison photo."
              >
                <select
                  id="slot"
                  name="slot"
                  className="input w-full"
                  defaultValue="baseline"
                  required
                >
                  <option value="baseline">Baseline</option>
                  <option value="current">Current</option>
                </select>
              </FormField>

              <FormField
                id="photo"
                label="Bathroom Base Shot"
                required
                hint="Use one portrait photo from the main bathroom direction."
              >
                <Input
                  id="photo"
                  name="photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  required
                />
              </FormField>

              <Button type="submit" className="w-full">
                Upload Photo
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Case Runner</CardTitle>
            <CardDescription>
              Once both photos exist, run the local engine to generate findings and a report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cases.length === 0 ? (
              <EmptyState
                title="No bathroom cases yet"
                description="Upload a baseline or current photo from your phone to create the first case."
              />
            ) : (
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Case</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((item) => (
                      <TableRow key={item.caseId}>
                        <TableCell className="font-medium">{item.caseId}</TableCell>
                        <TableCell>
                          <Badge variant={item.baselineExists ? "success" : "neutral"}>
                            {item.baselineExists ? "Uploaded" : "Missing"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.currentExists ? "success" : "neutral"}>
                            {item.currentExists ? "Uploaded" : "Missing"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.findings ? (
                            <div className="space-y-1 text-sm">
                              <div>
                                <strong>Room:</strong> {item.findings.sameRoomVerdict}
                              </div>
                              <div>
                                <strong>Change:</strong> {item.findings.changeSeverity}
                              </div>
                              <div>
                                <strong>Flags:</strong> {item.findings.findingCount}
                              </div>
                            </div>
                          ) : item.reportExists ? (
                            <Badge variant="info">Report saved</Badge>
                          ) : (
                            <Badge variant="neutral">Not run yet</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <form action={runBathroomCase}>
                            <input type="hidden" name="case_id" value={item.caseId} />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={!item.baselineExists || !item.currentExists}
                            >
                              Run Engine
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
