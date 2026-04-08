import { describe, expect, it } from "vitest";
import {
  getSessionCookieOptions,
  getSessionExpiration,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookies";

describe("auth cookies", () => {
  it("uses session cookie name contract", () => {
    expect(SESSION_COOKIE_NAME).toBe("session_id");
  });

  it("creates secure cookie options structure", () => {
    const expiresAt = getSessionExpiration(new Date("2026-01-01T00:00:00.000Z"));
    const options = getSessionCookieOptions(expiresAt);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.expires).toBeInstanceOf(Date);
  });
});
