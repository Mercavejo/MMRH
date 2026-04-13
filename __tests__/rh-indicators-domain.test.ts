import { describe, expect, it } from "vitest";
import {
  buildOperationalIndicators,
  normalizeOperationalIndicatorsFilters,
} from "@/modules/indicators/domain/operational-indicators";

describe("operational indicators domain", () => {
  it("normalizes valid filters and trims organizational unit", () => {
    const normalized = normalizeOperationalIndicatorsFilters({
      batchId: " bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb ",
      from: "2026-04-10T00:00:00.000Z",
      to: "2026-04-13T23:59:59.999Z",
      organizationalUnit: " financeiro ",
    });

    expect(normalized.batchId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(normalized.organizationalUnit).toBe("financeiro");
    expect(normalized.from?.toISOString()).toBe("2026-04-10T00:00:00.000Z");
    expect(normalized.to?.toISOString()).toBe("2026-04-13T23:59:59.999Z");
  });

  it("throws when period is invalid", () => {
    expect(() =>
      normalizeOperationalIndicatorsFilters({
        from: "2026-04-13T23:59:59.999Z",
        to: "2026-04-10T00:00:00.000Z",
      }),
    ).toThrow("Periodo invalido.");
  });

  it("builds indicators with division-by-zero safety", () => {
    const indicators = buildOperationalIndicators({
      totalBatches: 0,
      publishedBatches: 0,
      routingTotalCount: 0,
      routingMatchedCount: 0,
      pendingItems: 0,
      ambiguousItems: 0,
    });

    expect(indicators.deliveryRate).toBe(0);
    expect(indicators.routingAccuracy).toBe(0);
    expect(indicators.pendingCount).toBe(0);
  });

  it("calculates delivery, accuracy and pending totals", () => {
    const indicators = buildOperationalIndicators({
      totalBatches: 10,
      publishedBatches: 8,
      routingTotalCount: 100,
      routingMatchedCount: 92,
      pendingItems: 3,
      ambiguousItems: 2,
    });

    expect(indicators.deliveryRate).toBe(0.8);
    expect(indicators.routingAccuracy).toBe(0.92);
    expect(indicators.pendingCount).toBe(5);
    expect(indicators.totals.totalBatches).toBe(10);
  });
});