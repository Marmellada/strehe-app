"use client";

import { useMemo, useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import {
  getCasePhotoStoragePath,
  normalizeCaseId,
  type InspectionCaptureSlot,
  type InspectionRoomType,
  INSPECTION_STORAGE_BUCKET,
} from "@/lib/inspection-lab/bathroom-base-shot";
import { saveInspectionLabPhotoMetadataAction } from "@/app/inspection-lab/bathroom-base-shot/actions";

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

function isAllowedImageType(mimeType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(
    mimeType
  );
}

export function RoomStateUploadForm() {
  const [caseId, setCaseId] = useState("");
  const [roomType, setRoomType] = useState<InspectionRoomType>("living_room");
  const [slot, setSlot] = useState<InspectionCaptureSlot>("baseline");
  const [orderIndex, setOrderIndex] = useState("1");
  const [photoType, setPhotoType] = useState("wide");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const photoOptions = useMemo(() => PHOTO_TYPE_OPTIONS[roomType], [roomType]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);

    try {
      if (!caseId.trim()) {
        throw new Error("Case ID is required.");
      }

      const parsedOrderIndex = Number(orderIndex);
      if (!Number.isInteger(parsedOrderIndex) || parsedOrderIndex < 1) {
        throw new Error("Order must be a whole number starting from 1.");
      }

      if (!file) {
        throw new Error("Please choose a photo to upload.");
      }

      if (!isAllowedImageType(file.type)) {
        throw new Error("Please use JPG, PNG, or WEBP.");
      }

      const normalizedCaseId = normalizeCaseId(caseId);
      const storagePath = getCasePhotoStoragePath(
        normalizedCaseId,
        slot,
        parsedOrderIndex,
        file.name || "capture.jpg"
      );

      setIsUploading(true);

      const supabase = getBrowserSupabaseClient();

      const { error: uploadError } = await supabase.storage
        .from(INSPECTION_STORAGE_BUCKET)
        .upload(storagePath, file, {
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const metadataResult = await saveInspectionLabPhotoMetadataAction({
        caseId: normalizedCaseId,
        roomType,
        slot,
        orderIndex: parsedOrderIndex,
        photoType: photoType || null,
        storagePath,
      });

      if (!metadataResult.ok) {
        await supabase.storage.from(INSPECTION_STORAGE_BUCKET).remove([storagePath]);
        throw new Error(metadataResult.error);
      }

      setMessage(
        slot === "baseline"
          ? "Photo uploaded. Baseline processing has started and review will unlock when it is ready."
          : "Photo uploaded successfully."
      );
      setFile(null);
      setOrderIndex(String(parsedOrderIndex + 1));

      const input = document.getElementById("photo") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        id="case_id"
        label="Case ID"
        required
        hint="Use a stable case name like apartment-12-living-room-main."
      >
        <Input
          id="case_id"
          name="case_id"
          value={caseId}
          onChange={(event) => setCaseId(event.target.value)}
          placeholder="e.g., apartment-12-living-room-main"
          required
        />
      </FormField>

      <FormField
        id="room_type"
        label="Room Type"
        required
        hint="Use bathroom for fixtures first, or living room for larger furniture checks."
      >
        <select
          id="room_type"
          name="room_type"
          className="input w-full"
          value={roomType}
          onChange={(event) => {
            const nextRoomType =
              event.target.value === "bathroom" ? "bathroom" : "living_room";
            setRoomType(nextRoomType);
            setPhotoType(PHOTO_TYPE_OPTIONS[nextRoomType][0] || "wide");
          }}
          required
        >
          <option value="living_room">Living Room</option>
          <option value="bathroom">Bathroom</option>
        </select>
      </FormField>

      <FormField
        id="slot"
        label="Capture Set"
        required
        hint="Baseline defines the room contract. Current is the new observation set."
      >
        <select
          id="slot"
          name="slot"
          className="input w-full"
          value={slot}
          onChange={(event) =>
            setSlot(event.target.value === "current" ? "current" : "baseline")
          }
          required
        >
          <option value="baseline">Baseline</option>
          <option value="current">Current</option>
        </select>
      </FormField>

      <FormField
        id="order_index"
        label="Order"
        required
        hint="Keep the same order logic between baseline and current."
      >
        <Input
          id="order_index"
          name="order_index"
          type="number"
          min={1}
          step={1}
          value={orderIndex}
          onChange={(event) => setOrderIndex(event.target.value)}
          placeholder="e.g., 1"
          required
        />
      </FormField>

      <FormField
        id="photo_type"
        label="Photo Type"
        hint="Pick the best room-specific angle or object label. The engine only treats some major objects as high-confidence tracked targets."
      >
        <select
          id="photo_type"
          name="photo_type"
          className="input w-full"
          value={photoType}
          onChange={(event) => setPhotoType(event.target.value)}
        >
          {photoOptions.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id="photo"
        label="Room Photo"
        required
        hint="You can upload from camera or gallery/memory. Direct upload goes to Supabase Storage."
      >
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
          required
        />
      </FormField>

      {errorMessage ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isUploading}>
        {isUploading ? "Uploading..." : "Upload Photo"}
      </Button>
    </form>
  );
}
