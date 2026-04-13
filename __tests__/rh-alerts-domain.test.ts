import { describe, expect, it } from "vitest";
import {
  buildOperationalAlerts,
  isAlertEmissionWithinSla,
  isValidAlertStatusTransition,
  normalizeOperationalAlertsFilters,
} from "@/modules/alerts/domain/operational-alert";

describe("operational alerts domain", () => {
  it("normalizes filters", () => {
    const filters = normalizeOperationalAlertsFilters({
      status: " open ",
      severity: "critical",
      batchId: " bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb ",
      from: "2026-04-13T00:00:00.000Z",
      to: "2026-04-13T23:59:59.000Z",
    });

    expect(filters.status).toBe("open");
    expect(filters.severity).toBe("critical");
    expect(filters.batchId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("validates status transitions", () => {
    expect(isValidAlertStatusTransition("open", "in_treatment")).toBe(true);
    expect(isValidAlertStatusTransition("in_treatment", "resolved")).toBe(true);
    expect(isValidAlertStatusTransition("resolved", "in_treatment")).toBe(false);
  });

  it("builds deduplicated alerts and computes SLA", () => {
    const alerts = buildOperationalAlerts(
      [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          correlationId: "11111111-1111-4111-8111-111111111111",
          tenantId: "11111111-1111-4111-8111-111111111111",
          validationStatus: "validated",
          routingStatus: "completed",
          routingTotalCount: 100,
          routingMatchedCount: 100,
          routingPendingCount: 0,
          routingFailedCount: 0,
          routingAmbiguousCount: 0,
          publicationStatus: "published",
          createdAt: "2026-04-13T10:00:00.000Z",
          updatedAt: "2026-04-13T10:10:00.000Z",
          routingProcessedAt: "2026-04-13T10:08:00.000Z",
          publishedAt: "2026-04-13T10:09:00.000Z",
          organizationalUnit: "financeiro",
        },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          correlationId: "22222222-2222-4222-8222-222222222222",
          tenantId: "11111111-1111-4111-8111-111111111111",
          validationStatus: "validated",
          routingStatus: "completed",
          routingTotalCount: 100,
          routingMatchedCount: 98,
          routingPendingCount: 0,
          routingFailedCount: 2,
          routingAmbiguousCount: 0,
          publicationStatus: "failed",
          createdAt: "2026-04-13T10:00:00.000Z",
          updatedAt: "2026-04-13T10:20:00.000Z",
          routingProcessedAt: "2026-04-13T10:19:00.000Z",
          publishedAt: null,
          organizationalUnit: "rh",
        },
      ],
      {},
    );

    expect(alerts.some((alert) => alert.status === "resolved")).toBe(true);
    expect(alerts.some((alert) => alert.status === "open")).toBe(true);
    expect(alerts.every((alert) => isAlertEmissionWithinSla(alert))).toBe(true);
  });
});
