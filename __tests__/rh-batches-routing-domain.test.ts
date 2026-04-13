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
        codigo_colaborador: "123",
        nome_normalizado: null,
        match_strategy: "codigo_colaborador",
        page_index: 1,
        blocked_reason_code: null,
        blocked_reason_message: null,
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
    expect(result.items[1].blocked_reason_code).toBe("MISSING_EMPLOYEE_CODE");
  });

  it("uses normalized-name fallback only when code is absent", () => {
    const result = routeBatchManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      manifest: [
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
          employee_identifier: "",
          codigo_colaborador: null,
          nome_normalizado: "ana souza",
          match_strategy: "nome_normalizado",
          page_index: 1,
          blocked_reason_code: null,
          blocked_reason_message: null,
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      processedAt: "2026-04-09T12:00:00.000Z",
    });

    expect(result.routing_status).toBe("completed");
    expect(result.items[0].routing_status).toBe("matched");
    expect(result.items[0].match_strategy).toBe("nome_normalizado");
  });

  it("blocks fallback when normalized name is duplicated", () => {
    const result = routeBatchManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      manifest: [
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
          employee_identifier: "",
          codigo_colaborador: null,
          nome_normalizado: "ana souza",
          match_strategy: "nome_normalizado",
          page_index: 1,
          blocked_reason_code: null,
          blocked_reason_message: null,
          document_type: "holerite",
          period_ref: "2026-03",
        },
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2",
          employee_identifier: "",
          codigo_colaborador: null,
          nome_normalizado: "ana souza",
          match_strategy: "nome_normalizado",
          page_index: 2,
          blocked_reason_code: null,
          blocked_reason_message: null,
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      processedAt: "2026-04-09T12:00:00.000Z",
    });

    expect(result.routing_status).toBe("blocked");
    expect(result.ambiguous_documents).toBe(2);
    expect(result.items[0].blocked_reason_code).toBe("DUPLICATE_NORMALIZED_NAME");
  });

  it("keeps one page mapped to one collaborator without cross-sharing", () => {
    const result = routeBatchManifest({
      batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      manifest: [
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
          employee_identifier: "EMP-001",
          codigo_colaborador: "EMP-001",
          nome_normalizado: "ana souza",
          match_strategy: "codigo_colaborador",
          page_index: 1,
          blocked_reason_code: null,
          blocked_reason_message: null,
          document_type: "holerite",
          period_ref: "2026-03",
        },
        {
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2",
          employee_identifier: "EMP-002",
          codigo_colaborador: "EMP-002",
          nome_normalizado: "bruno lima",
          match_strategy: "codigo_colaborador",
          page_index: 2,
          blocked_reason_code: null,
          blocked_reason_message: null,
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      processedAt: "2026-04-09T12:00:00.000Z",
    });

    expect(result.routing_status).toBe("completed");
    expect(result.items.every((item) => item.routing_status === "matched")).toBe(true);
    expect(result.items[0].employee_identifier).toBe("EMP-001");
    expect(result.items[1].employee_identifier).toBe("EMP-002");
    expect(new Set(result.items.map((item) => item.document_id)).size).toBe(2);
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