"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FormField, Input, Textarea } from "@/components/ui";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

type HouseholdSpace = {
  id: string;
  name: string;
};

type InitiateResponse = {
  ok: boolean;
  error?: string;
  jobId?: string;
  upload?: {
    bucket: string;
    path: string;
    token: string;
  };
};

async function responseJson(response: Response) {
  return (await response.json()) as InitiateResponse;
}

export function ReceiptUploadForm({
  spaces,
}: {
  spaces: HouseholdSpace[];
}) {
  const router = useRouter();
  const [householdSpaceId, setHouseholdSpaceId] = useState(spaces[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [sourceNote, setSourceNote] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStage(null);

    let jobId: string | null = null;

    try {
      if (!householdSpaceId) {
        throw new Error("Choose a household space.");
      }
      if (!file) {
        throw new Error("Choose a receipt photo or PDF.");
      }
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error("Use a JPG, PNG, or PDF receipt.");
      }
      if (file.size < 1 || file.size > MAX_RECEIPT_BYTES) {
        throw new Error("The receipt must be between 1 byte and 15 MB.");
      }

      setIsUploading(true);
      setStage("Preparing a private temporary upload...");

      const initiateResponse = await fetch(
        "/api/household/finance/receipts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdSpaceId,
            filename: file.name,
            mimeType: file.type,
            byteSize: file.size,
            sourceNote,
          }),
        }
      );
      const initiated = await responseJson(initiateResponse);
      if (
        !initiateResponse.ok ||
        !initiated.ok ||
        !initiated.jobId ||
        !initiated.upload
      ) {
        throw new Error(initiated.error || "Receipt upload could not start.");
      }
      jobId = initiated.jobId;

      setStage("Uploading directly to the private temporary inbox...");
      const supabase = getBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(initiated.upload.bucket)
        .uploadToSignedUrl(
          initiated.upload.path,
          initiated.upload.token,
          file,
          {
            contentType: file.type,
            upsert: false,
          }
        );
      if (uploadError) {
        throw new Error(`Temporary upload failed: ${uploadError.message}`);
      }

      setStage("Sending the receipt to your local finance AI...");
      const releaseResponse = await fetch(
        "/api/household/finance/receipts",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        }
      );
      const released = await responseJson(releaseResponse);
      if (!releaseResponse.ok || !released.ok) {
        throw new Error(released.error || "Receipt could not be released.");
      }

      setFile(null);
      setSourceNote("");
      const input = document.getElementById(
        "finance-receipt"
      ) as HTMLInputElement | null;
      if (input) input.value = "";

      router.push(`/household/finance?receipt=${jobId}`);
      router.refresh();
    } catch (error) {
      if (jobId) {
        await fetch("/api/household/finance/receipts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        }).catch(() => undefined);
      }
      setErrorMessage(
        error instanceof Error ? error.message : "Receipt upload failed."
      );
      setStage(null);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <FormField id="receipt-household-space" label="Household space" required>
        <select
          id="receipt-household-space"
          value={householdSpaceId}
          onChange={(event) => setHouseholdSpaceId(event.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--input-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--input-ring-color)] focus-visible:ring-offset-2"
        >
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="finance-receipt"
        label="Receipt photo or PDF"
        required
        hint="JPG, PNG, or PDF, up to 15 MB. On a phone, you can open the camera from this field."
      >
        <Input
          id="finance-receipt"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          required
        />
      </FormField>

      <FormField
        id="receipt-source-note"
        label="Optional note"
        hint="Temporary context for the local processor, such as who paid. Do not enter account credentials."
      >
        <Textarea
          id="receipt-source-note"
          value={sourceNote}
          onChange={(event) => setSourceNote(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Example: Household groceries, paid by Milot"
        />
      </FormField>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}

      {stage ? (
        <div
          role="status"
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100"
        >
          {stage}
        </div>
      ) : null}

      <Button type="submit" disabled={isUploading}>
        {isUploading ? "Uploading Receipt..." : "Upload Receipt To Local AI"}
      </Button>
    </form>
  );
}
