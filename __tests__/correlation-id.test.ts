import { describe, expect, it } from "vitest";
import { resolveCorrelationId } from "@/lib/observability/correlation-id";

describe("correlation id", () => {
  it("reuses provided correlation id", () => {
    expect(resolveCorrelationId("cid-abc")).toBe("cid-abc");
  });

  it("generates correlation id when input is missing", () => {
    const generated = resolveCorrelationId(null);
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
