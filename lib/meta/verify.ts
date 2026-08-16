import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PATTERN = /^sha256=([0-9a-fA-F]{64})$/;

export type BoundedBodyReadResult =
  | { withinLimit: true; rawBody: Buffer }
  | { withinLimit: false };

export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  limitBytes: number
): Promise<BoundedBodyReadResult> {
  if (!body) {
    return { withinLimit: true, rawBody: Buffer.alloc(0) };
  }

  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return { withinLimit: true, rawBody: Buffer.concat(chunks, totalBytes) };
      }

      totalBytes += value.byteLength;
      if (totalBytes > limitBytes) {
        try {
          await reader.cancel();
        } catch {
          // The response is already determined; cancellation is best effort.
        }
        return { withinLimit: false };
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
}

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | null,
  appSecret: string
) {
  if (!signatureHeader) return false;

  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) return false;

  const suppliedDigest = Buffer.from(match[1], "hex");
  const expectedDigest = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest();

  return (
    suppliedDigest.length === expectedDigest.length &&
    timingSafeEqual(suppliedDigest, expectedDigest)
  );
}

export function verifyMetaSignatureAgainstSecrets(
  rawBody: Buffer,
  signatureHeader: string | null,
  appSecrets: Iterable<string | undefined>
) {
  if (!signatureHeader) return false;

  const match = SIGNATURE_PATTERN.exec(signatureHeader);
  if (!match) return false;

  const suppliedDigest = Buffer.from(match[1], "hex");
  let isAuthenticated = false;

  for (const appSecret of appSecrets) {
    if (!appSecret) continue;

    const expectedDigest = createHmac("sha256", appSecret)
      .update(rawBody)
      .digest();
    const isMatch =
      suppliedDigest.length === expectedDigest.length &&
      timingSafeEqual(suppliedDigest, expectedDigest);

    isAuthenticated = isAuthenticated || isMatch;
  }

  return isAuthenticated;
}

export function constantTimeTokenEqual(supplied: string, expected: string) {
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(suppliedDigest, expectedDigest);
}

export function sha256Hex(rawBody: Buffer) {
  return createHash("sha256").update(rawBody).digest("hex");
}
