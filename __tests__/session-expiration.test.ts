import { describe, expect, it } from "vitest";
import { getSessionExpiration } from "@/lib/auth/cookies";

describe("session expiration", () => {
  it("sets inactivity expiration to 30 minutes", () => {
    const base = new Date("2026-04-08T18:00:00.000Z");
    const expiresAt = getSessionExpiration(base);

    expect(expiresAt.toISOString()).toBe("2026-04-08T18:30:00.000Z");
  });
});
