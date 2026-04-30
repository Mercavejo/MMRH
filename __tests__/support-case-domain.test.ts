import { describe, expect, it } from "vitest";
import {
  deriveSupportCaseSeverity,
  deriveSupportCaseStatus,
  isValidSupportCaseStatusTransition,
  normalizeSupportCaseFilters,
} from "@/modules/support/domain/support-case";

describe("support case domain", () => {
  it("normalizes filters and validates period", () => {
    const filters = normalizeSupportCaseFilters({
      from: "2026-04-13T00:00:00.000Z",
      to: "2026-04-13T23:59:59.000Z",
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      documentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(filters.batchId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(filters.documentId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(filters.userId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("rejects invalid transitions", () => {
    expect(isValidSupportCaseStatusTransition("open", "in_treatment")).toBe(true);
    expect(isValidSupportCaseStatusTransition("in_treatment", "resolved")).toBe(true);
    expect(isValidSupportCaseStatusTransition("resolved", "open")).toBe(false);
  });

  it("derives status and severity from events", () => {
    const events = [
      {
        id: "evt-1",
        action: "support.case.recovery.triggered.v1",
        status: "success" as const,
        resource_type: "support_case",
        resource_id: "22222222-2222-4222-8222-222222222222",
        actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlation_id: "22222222-2222-4222-8222-222222222222",
        created_at: "2026-04-13T10:00:00.000Z",
        details: { severity: "critical" },
      },
    ];

    expect(deriveSupportCaseStatus(events)).toBe("in_treatment");
    expect(deriveSupportCaseSeverity(events)).toBe("critical");
  });
});
