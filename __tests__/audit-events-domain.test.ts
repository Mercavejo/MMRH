import { describe, expect, it } from "vitest";
import {
  buildAuditTimeline,
  normalizeAuditFilters,
} from "@/modules/audit/domain/audit-event-filters";

describe("audit event filters domain", () => {
  it("normalizes filter payload and pagination", () => {
    const normalized = normalizeAuditFilters({
      from: "2026-04-10T00:00:00.000Z",
      to: "2026-04-13T23:59:59.999Z",
      batchId: " bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb ",
      page: 0,
      pageSize: 999,
    });

    expect(normalized.batchId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(normalized.page).toBe(1);
    expect(normalized.pageSize).toBe(100);
  });

  it("throws for inverted period range", () => {
    expect(() =>
      normalizeAuditFilters({
        from: "2026-04-13T23:59:59.999Z",
        to: "2026-04-10T00:00:00.000Z",
      }),
    ).toThrow("Periodo invalido");
  });

  it("builds chronological timeline ascending by occurred_at", () => {
    const timeline = buildAuditTimeline([
      {
        id: "evt-2",
        action: "rh.batch.publication.finished.v1",
        status: "success",
        created_at: "2026-04-13T12:10:00.000Z",
      },
      {
        id: "evt-1",
        action: "rh.batch.import.validated.v1",
        status: "success",
        created_at: "2026-04-13T12:00:00.000Z",
      },
    ]);

    expect(timeline[0].event_id).toBe("evt-1");
    expect(timeline[1].event_id).toBe("evt-2");
  });
});
