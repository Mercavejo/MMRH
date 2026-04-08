import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "@/lib/api/response";

describe("api response envelope", () => {
  it("returns success envelope with required shape", () => {
    const result = successResponse({ ok: true }, "cid-123", "tenant-1");

    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeNull();
    expect(result.meta.correlation_id).toBe("cid-123");
    expect(result.meta.tenant_id).toBe("tenant-1");
    expect(result.meta.timestamp).toBeDefined();
  });

  it("returns error envelope with required shape", () => {
    const result = errorResponse(
      "VALIDATION_ERROR",
      "Invalid payload",
      "cid-999",
      { field: "email" },
      "tenant-2",
    );

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.message).toBe("Invalid payload");
    expect(result.error?.details).toEqual({ field: "email" });
    expect(result.meta.correlation_id).toBe("cid-999");
    expect(result.meta.tenant_id).toBe("tenant-2");
  });
});
