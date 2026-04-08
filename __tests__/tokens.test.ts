import { describe, expect, it } from "vitest";
import { tokens } from "@/lib/theme/tokens";

describe("design tokens", () => {
  it("contains all required semantic states", () => {
    expect(tokens.colors.success).toBeTruthy();
    expect(tokens.colors.warning).toBeTruthy();
    expect(tokens.colors.error).toBeTruthy();
    expect(tokens.colors.pending).toBeTruthy();
    expect(tokens.colors.processing).toBeTruthy();
  });

  it("uses 8px spacing scale", () => {
    expect(tokens.spacing.xs).toBe(4);
    expect(tokens.spacing.sm).toBe(8);
    expect(tokens.spacing.md).toBe(16);
    expect(tokens.spacing.lg).toBe(24);
    expect(tokens.spacing.xl).toBe(32);
  });
});
