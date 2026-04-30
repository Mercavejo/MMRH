import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDashboardSummary } from "@/modules/indicators/application/get-dashboard-summary";
import * as indicatorsRepo from "@/modules/indicators/infrastructure/indicators-repository";
import * as batchesRepo from "@/modules/batches/infrastructure/batch-repository";
import type { BatchPublicationSnapshot } from "@/modules/batches/infrastructure/batch-repository";
import * as auditRepo from "@/modules/audit/infrastructure/audit-events-repository";

vi.mock("@/modules/indicators/infrastructure/indicators-repository");
vi.mock("@/modules/batches/infrastructure/batch-repository");
vi.mock("@/modules/audit/infrastructure/audit-events-repository");

describe("getDashboardSummary application service", () => {
  const tenantId = "test-tenant-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consolidates data from multiple sources correctly", async () => {
    // Mock Indicators
    vi.mocked(indicatorsRepo.getOperationalIndicatorsAggregateFromDb).mockResolvedValue({
      totalBatches: 10,
      publishedBatches: 8,
      routingTotalCount: 100,
      routingMatchedCount: 95,
      pendingItems: 2,
      ambiguousItems: 1,
    });

    // Mock Latest Batch
    const latestBatch: BatchPublicationSnapshot = {
      id: "batch-123",
      tenantId,
      validationStatus: "validated",
      routingStatus: "processed",
      publicationStatus: "published",
      routingMatchedCount: 48,
      routingPendingCount: 1,
      routingFailedCount: 1,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingTotalCount: 50,
      routingProcessedAt: new Date("2026-04-17T10:00:00Z"),
      publicationAttempts: 1,
      publishedAt: new Date("2026-04-17T10:05:00Z"),
      publishedBy: "user-123",
      lastPublicationCorrelationId: "corr-123",
      lastPublicationIdempotencyKey: "idem-123",
      lastPublicationError: null,
    };

    vi.mocked(batchesRepo.loadLatestBatch).mockResolvedValue(latestBatch);

    // Mock Audit Events
    vi.mocked(auditRepo.listAuditEventsFromDb).mockResolvedValue({
      total: 1,
      events: [
        {
          id: "event-1",
          action: "batch-published",
          status: "success",
          resource_type: "batch",
          resource_id: "batch-123",
          actor_id: "user-123",
          correlation_id: "corr-123",
          created_at: "2026-04-17T10:05:00.000Z",
          details: { description: "Lote publicado com sucesso" }
        }
      ],
      timelineEvents: []
    });

    const result = await getDashboardSummary({ tenantId });

    expect(result.summary.totalBatches).toBe(10);
    expect(result.summary.accuracy).toBe(95); // 95/100 * 100
    expect(result.summary.pendingExceptions).toBe(3); // 2 + 1
    expect(result.summary.latestBatch?.id).toBe("batch-123");
    
    expect(result.recentActivities).toHaveLength(1);
    expect(result.recentActivities[0].description).toBe("Lote publicado com sucesso");
  });

  it("handles empty states gracefully", async () => {
    vi.mocked(indicatorsRepo.getOperationalIndicatorsAggregateFromDb).mockResolvedValue({
      totalBatches: 0,
      publishedBatches: 0,
      routingTotalCount: 0,
      routingMatchedCount: 0,
      pendingItems: 0,
      ambiguousItems: 0,
    });
    vi.mocked(batchesRepo.loadLatestBatch).mockResolvedValue(null);
    vi.mocked(auditRepo.listAuditEventsFromDb).mockResolvedValue({
      total: 0,
      events: [],
      timelineEvents: []
    });

    const result = await getDashboardSummary({ tenantId });

    expect(result.summary.totalBatches).toBe(0);
    expect(result.summary.accuracy).toBe(0);
    expect(result.summary.latestBatch).toBeNull();
    expect(result.recentActivities).toHaveLength(0);
  });
});
