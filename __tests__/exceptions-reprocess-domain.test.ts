import { describe, expect, it } from "vitest";
import {
  hasIdempotencyHit,
  isExceptionEligibleForReprocess,
} from "@/modules/exceptions/domain/exception";

describe("exceptions reprocess domain", () => {
  it("marks only in-treatment + reprocessable as eligible", () => {
    expect(
      isExceptionEligibleForReprocess({
        current_state: "in-treatment",
        correction_result: "reprocessable",
      }),
    ).toBe(true);

    expect(
      isExceptionEligibleForReprocess({
        current_state: "pending",
        correction_result: "reprocessable",
      }),
    ).toBe(false);

    expect(
      isExceptionEligibleForReprocess({
        current_state: "in-treatment",
        correction_result: "reject",
      }),
    ).toBe(false);

    expect(
      isExceptionEligibleForReprocess({
        current_state: "resolved",
        correction_result: "reprocessable",
      }),
    ).toBe(false);
  });

  it("detects idempotency hit when keys are equal", () => {
    expect(hasIdempotencyHit("idem-001", "idem-001")).toBe(true);
    expect(hasIdempotencyHit("idem-001", "idem-002")).toBe(false);
    expect(hasIdempotencyHit(null, "idem-002")).toBe(false);
  });
});
