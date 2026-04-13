import { createHmac, timingSafeEqual } from "node:crypto";

export function signHmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function isValidHmacSignature(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isTimestampWithinSkew(timestamp: string, maxSkewMs: number, nowMs = Date.now()): boolean {
  const parsedMs = Date.parse(timestamp);
  if (Number.isNaN(parsedMs)) {
    return false;
  }

  return Math.abs(nowMs - parsedMs) <= maxSkewMs;
}