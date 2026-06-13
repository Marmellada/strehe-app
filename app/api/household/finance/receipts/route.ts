import { getCurrentUserWithRole } from "@/lib/auth/get-current-user-with-role";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const RECEIPT_CAPABILITY = "finance.receipt.ingest";
const ARTIFACT_BUCKET = "agent-artifacts";
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;
const RECEIPT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_OPEN_RECEIPT_JOBS = 10;

const MIME_BY_EXTENSION = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".pdf", "application/pdf"],
]);

type ReceiptRequest = {
  householdSpaceId?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  byteSize?: unknown;
  sourceNote?: unknown;
  jobId?: unknown;
};

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

function cleanFilename(value: unknown) {
  const filename = String(value || "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!filename || filename.length > 180) {
    throw new Error("Receipt filename must contain 1 to 180 characters.");
  }
  return filename;
}

function receiptFileDetails(payload: ReceiptRequest) {
  const filename = cleanFilename(payload.filename);
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || "";
  const expectedMime = MIME_BY_EXTENSION.get(extension);
  const mimeType = String(payload.mimeType || "").trim().toLowerCase();
  const byteSize = Number(payload.byteSize);

  if (!expectedMime || expectedMime !== mimeType) {
    throw new Error("Use a JPG, PNG, or PDF receipt.");
  }
  if (!Number.isSafeInteger(byteSize) || byteSize < 1) {
    throw new Error("The receipt file is empty.");
  }
  if (byteSize > MAX_RECEIPT_BYTES) {
    throw new Error("The receipt must be 15 MB or smaller.");
  }

  return { filename, extension, mimeType, byteSize };
}

async function requireReceiptAccess(householdSpaceId: string) {
  const current = await getCurrentUserWithRole();
  if (!current) {
    return { error: jsonError("Sign in to upload a receipt.", 401) };
  }
  if (!current.appUser.is_active) {
    return { error: jsonError("This user is not active.", 403) };
  }

  const supabase = await createClient();
  const { data: canEdit, error } = await supabase.rpc("can_edit_household", {
    target_space_id: householdSpaceId,
  });
  if (error || canEdit !== true) {
    return {
      error: jsonError(
        "You do not have permission to add receipts to this household.",
        403
      ),
    };
  }

  return { current };
}

async function readPayload(request: Request) {
  try {
    return (await request.json()) as ReceiptRequest;
  } catch {
    throw new Error("The receipt request is invalid.");
  }
}

export async function POST(request: Request) {
  let jobId: string | null = null;

  try {
    const payload = await readPayload(request);
    const householdSpaceId = String(payload.householdSpaceId || "").trim();
    if (!householdSpaceId) {
      return jsonError("Choose a household space.", 400);
    }

    const access = await requireReceiptAccess(householdSpaceId);
    if ("error" in access) return access.error;

    const file = receiptFileDetails(payload);
    const sourceNote = String(payload.sourceNote || "").trim();
    if (sourceNote.length > 300) {
      return jsonError("Receipt notes must not exceed 300 characters.", 400);
    }

    const admin = getAdminClient();
    const { count: openJobCount, error: openJobError } = await admin
      .from("agent_jobs")
      .select("id", { count: "exact", head: true })
      .eq("job_type", RECEIPT_CAPABILITY)
      .eq("requested_by_user_id", access.current.authUser.id)
      .in("status", ["queued", "running"]);
    if (openJobError) throw openJobError;
    if ((openJobCount ?? 0) >= MAX_OPEN_RECEIPT_JOBS) {
      return jsonError(
        "Wait for an earlier receipt to finish before uploading another.",
        429
      );
    }

    const { data: agent, error: agentError } = await admin
      .from("agent_principals")
      .select("id")
      .eq("agent_key", "finance.local")
      .eq("is_active", true)
      .maybeSingle();
    if (agentError || !agent) {
      return jsonError("The local finance agent is not configured.", 503);
    }

    const { data: capability, error: capabilityError } = await admin
      .from("agent_capabilities")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("capability_key", RECEIPT_CAPABILITY)
      .maybeSingle();
    if (capabilityError || !capability) {
      return jsonError(
        "The local finance agent is not ready for receipt uploads.",
        503
      );
    }

    const expiresAt = new Date(Date.now() + RECEIPT_RETENTION_MS).toISOString();
    const { data: job, error: jobError } = await admin
      .from("agent_jobs")
      .insert({
        job_type: RECEIPT_CAPABILITY,
        required_capability: RECEIPT_CAPABILITY,
        workspace_type: "household",
        household_space_id: householdSpaceId,
        subject_type: "local_receipt_upload",
        requested_by_user_id: access.current.authUser.id,
        assigned_agent_id: agent.id,
        status: "queued",
        priority: 10,
        payload: {
          schema_version: 1,
          original_filename: file.filename,
          mime_type: file.mimeType,
          byte_size: file.byteSize,
          source_note: sourceNote || null,
          temporary_upload: true,
        },
        requires_review: false,
        available_at: expiresAt,
        expires_at: expiresAt,
        max_attempts: 3,
      })
      .select("id")
      .single();
    if (jobError || !job) {
      throw new Error(jobError?.message || "Receipt job creation failed.");
    }
    jobId = job.id;

    const storagePath = `${agent.id}/${job.id}/input/receipt${file.extension}`;
    const { data: signedUpload, error: signedUploadError } = await admin.storage
      .from(ARTIFACT_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signedUploadError || !signedUpload) {
      throw new Error(
        signedUploadError?.message || "Temporary upload token creation failed."
      );
    }

    const { error: artifactError } = await admin
      .from("agent_artifacts")
      .insert({
        job_id: job.id,
        artifact_kind: "input",
        storage_bucket: ARTIFACT_BUCKET,
        storage_path: storagePath,
        mime_type: file.mimeType,
        byte_size: file.byteSize,
        metadata: {
          original_filename: file.filename,
          file_extension: file.extension,
          temporary_transport: true,
        },
        expires_at: expiresAt,
      });
    if (artifactError) throw artifactError;

    return Response.json({
      ok: true,
      jobId: job.id,
      upload: {
        bucket: ARTIFACT_BUCKET,
        path: storagePath,
        token: signedUpload.token,
      },
    });
  } catch (error) {
    if (jobId) {
      const admin = getAdminClient();
      const { data: artifacts } = await admin
        .from("agent_artifacts")
        .select("storage_path")
        .eq("job_id", jobId);
      const paths = (artifacts ?? []).map((artifact) => artifact.storage_path);
      if (paths.length > 0) {
        await admin.storage.from(ARTIFACT_BUCKET).remove(paths);
      }
      await admin.from("agent_jobs").delete().eq("id", jobId);
    }

    console.error("[FINANCE_RECEIPT_UPLOAD_INIT_ERROR]", error);
    return jsonError(
      error instanceof Error ? error.message : "Receipt upload could not start.",
      500
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readPayload(request);
    const jobId = String(payload.jobId || "").trim();
    if (!jobId) return jsonError("Receipt job ID is required.", 400);

    const admin = getAdminClient();
    const { data: job, error: jobError } = await admin
      .from("agent_jobs")
      .select("id, household_space_id, requested_by_user_id, status, job_type")
      .eq("id", jobId)
      .maybeSingle();
    if (
      jobError ||
      !job ||
      job.job_type !== RECEIPT_CAPABILITY ||
      !job.household_space_id
    ) {
      return jsonError("Receipt upload was not found.", 404);
    }

    const access = await requireReceiptAccess(job.household_space_id);
    if ("error" in access) return access.error;
    if (job.requested_by_user_id !== access.current.authUser.id) {
      return jsonError("Only the uploader can release this receipt.", 403);
    }
    if (job.status !== "queued") {
      return jsonError("This receipt has already been released.", 409);
    }

    const { data: artifact, error: artifactError } = await admin
      .from("agent_artifacts")
      .select("storage_bucket, storage_path")
      .eq("job_id", job.id)
      .eq("artifact_kind", "input")
      .single();
    if (artifactError || !artifact) {
      return jsonError("Temporary receipt metadata was not found.", 409);
    }

    const { data: exists, error: existsError } = await admin.storage
      .from(artifact.storage_bucket)
      .exists(artifact.storage_path);
    if (existsError || !exists) {
      return jsonError(
        "The temporary receipt upload has not completed yet.",
        409
      );
    }

    const { error: releaseError } = await admin
      .from("agent_jobs")
      .update({ available_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "queued");
    if (releaseError) throw releaseError;

    return Response.json({ ok: true, jobId: job.id, status: "queued" });
  } catch (error) {
    console.error("[FINANCE_RECEIPT_UPLOAD_RELEASE_ERROR]", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Receipt upload could not be released.",
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readPayload(request);
    const jobId = String(payload.jobId || "").trim();
    if (!jobId) return jsonError("Receipt job ID is required.", 400);

    const admin = getAdminClient();
    const { data: job, error: jobError } = await admin
      .from("agent_jobs")
      .select("id, household_space_id, requested_by_user_id, status, job_type")
      .eq("id", jobId)
      .maybeSingle();
    if (
      jobError ||
      !job ||
      job.job_type !== RECEIPT_CAPABILITY ||
      !job.household_space_id
    ) {
      return Response.json({ ok: true });
    }

    const access = await requireReceiptAccess(job.household_space_id);
    if ("error" in access) return access.error;
    if (job.requested_by_user_id !== access.current.authUser.id) {
      return jsonError("Only the uploader can cancel this receipt.", 403);
    }
    if (job.status !== "queued") {
      return jsonError("A running receipt cannot be cancelled here.", 409);
    }

    const { data: artifacts } = await admin
      .from("agent_artifacts")
      .select("storage_bucket, storage_path")
      .eq("job_id", job.id);
    for (const artifact of artifacts ?? []) {
      await admin.storage
        .from(artifact.storage_bucket)
        .remove([artifact.storage_path]);
    }
    const { error: deleteError } = await admin
      .from("agent_jobs")
      .delete()
      .eq("id", job.id);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[FINANCE_RECEIPT_UPLOAD_CANCEL_ERROR]", error);
    return jsonError("Receipt upload cleanup failed.", 500);
  }
}
