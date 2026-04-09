import { describe, expect, it } from "vitest";
import {
  buildBatchRoutingManifest,
  routeBatchManifest,
} from "@/lib/rh/batches/batch-routing";
import {
  buildPendingBatchRoutingProgress,
  buildBatchRoutingProgressFromRecord,
} from "@/lib/rh/batches/batch-progress";

describe("rh batch routing domain", () => {
  it("builds routing manifest entries with stable document ids", () => {
    const manifest = buildBatchRoutingManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      rows: [
        {
          employee_identifier: "123",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
    });

    expect(manifest).toEqual([
      {
        document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
        employee_identifier: "123",
        document_type: "holerite",
        period_ref: "2026-03",
      },
    ]);
  });

  it("blocks ambiguous documents and summarizes routing counts", () => {
    const result = routeBatchManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      manifest: [
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
          employee_identifier: "123",
          document_type: "holerite",
          period_ref: "2026-03",
        },
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2",
          employee_identifier: "123",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      processedAt: "2026-04-09T12:00:00.000Z",
    });

    expect(result.routing_status).toBe("blocked");
    expect(result.ambiguous_documents).toBe(2);
    expect(result.blocked_reason).toContain("ambiguidade");
    expect(result.items).toHaveLength(2);
    expect(result.items[0].routing_status).toBe("ambiguous");
  });

  it("marks mixed matched and failed documents as failed", () => {
    const result = routeBatchManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      manifest: [
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
          employee_identifier: "123",
          document_type: "holerite",
          period_ref: "2026-03",
        },
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2",
          employee_identifier: "",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      processedAt: "2026-04-09T12:00:00.000Z",
    });

    expect(result.routing_status).toBe("failed");
    expect(result.failed_documents).toBe(1);
    expect(result.matched_documents).toBe(1);
  });

  it("builds a pending progress snapshot before processing", () => {
    const progress = buildPendingBatchRoutingProgress({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      totalDocuments: 3,
    });

    expect(progress.routing_status).toBe("pending");
    expect(progress.pending_documents).toBe(3);
    expect(progress.matched_documents).toBe(0);
  });

  it("maps a persisted batch row to a progress snapshot", () => {
    const progress = buildBatchRoutingProgressFromRecord({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      routingStatus: "completed",
      routingTotalCount: 2,
      routingMatchedCount: 2,
      routingPendingCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingProcessedAt: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(progress.routing_status).toBe("completed");
    expect(progress.processed_at).toBe("2026-04-09T12:00:00.000Z");
  });
});