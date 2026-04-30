import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  headersMock,
  redirectMock,
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbInnerJoinMock,
  dbWhereMock,
  dbLimitMock,
  loadLatestBatchMock,
  writePlaytestEventMock,
  getDashboardSummaryMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbInnerJoinMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  loadLatestBatchMock: vi.fn(),
  writePlaytestEventMock: vi.fn(),
  getDashboardSummaryMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelectMock.mockReturnValue({
      from: dbFromMock.mockReturnValue({
        innerJoin: dbInnerJoinMock.mockReturnValue({
          where: dbWhereMock.mockReturnValue({
            limit: dbLimitMock,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/modules/batches/infrastructure/batch-repository", () => ({
  loadLatestBatch: loadLatestBatchMock,
}));

vi.mock("@/modules/indicators/application/get-dashboard-summary", () => ({
  getDashboardSummary: getDashboardSummaryMock,
}));

vi.mock("@/lib/observability/playtest-audit", () => ({
  writePlaytestEvent: writePlaytestEventMock,
}));

import RHDashboardPage from "@/app/rh/page";

describe("rh dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token" }),
    });
    headersMock.mockResolvedValue({
      get: vi.fn().mockReturnValue("11111111-1111-4111-8111-111111111111"),
    });
    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "11111111-1111-4111-8111-111111111111",
    });
    dbLimitMock.mockResolvedValue([{ name: "Gestor Demo", role: "rh_gestor" }]);
    loadLatestBatchMock.mockResolvedValue({
      id: "batch-1",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "processed",
      publicationStatus: "published",
      routingMatchedCount: 5,
      routingPendingCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingTotalCount: 5,
      routingProcessedAt: new Date("2026-04-28T10:00:00.000Z"),
      publicationAttempts: 1,
      publishedAt: new Date("2026-04-28T10:01:00.000Z"),
      publishedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lastPublicationCorrelationId: "corr-1",
      lastPublicationIdempotencyKey: "idem-1",
      lastPublicationError: null,
    });
    writePlaytestEventMock.mockResolvedValue(undefined);
    getDashboardSummaryMock.mockResolvedValue({
      summary: {
        totalBatches: 1,
        latestBatch: { id: "batch-1" },
        pendingExceptions: 0,
        accuracy: 99.5,
        openSupportCases: 0,
      },
      recentActivities: [],
    });
  });

  it("logs client dashboard success and keeps admin areas out of markup", async () => {
    const page = await RHDashboardPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Envios e Acompanhamento");
    expect(html).not.toContain("/rh/auditoria");
    expect(html).not.toContain("/rh/excecoes");
    expect(html).not.toContain("/rh/indicadores");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.dashboard.view",
        status: "success",
        resourceType: "dashboard",
      }),
    );
  });

  it("logs dashboard friction when latest batch loading fails", async () => {
    loadLatestBatchMock.mockRejectedValue(new Error("db offline"));

    const page = await RHDashboardPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Não foi possível carregar o painel de envios.");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.dashboard.friction",
        status: "failure",
        details: expect.objectContaining({ cause: "internal_error" }),
      }),
    );
  });

  it("keeps rh operator on client-safe dashboard", async () => {
    dbLimitMock.mockResolvedValue([{ name: "Operador Demo", role: "rh_operator" }]);

    const page = await RHDashboardPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Envios e Acompanhamento");
    expect(html).not.toContain("/rh/auditoria");
    expect(html).not.toContain("/rh/excecoes");
    expect(html).not.toContain("/rh/indicadores");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.dashboard.view",
        status: "success",
        resourceId: "client_dashboard",
      }),
    );
    expect(getDashboardSummaryMock).not.toHaveBeenCalled();
  });

  it("limits suporte dashboard links to reachable internal areas", async () => {
    dbLimitMock.mockResolvedValue([{ name: "Suporte Demo", role: "suporte" }]);

    const page = await RHDashboardPage();
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Painel de Gestão RH");
    expect(html).toContain("/rh/auditoria");
    expect(html).not.toContain("/rh/excecoes");
    expect(html).not.toContain("/rh/lotes");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.dashboard.internal.view",
        status: "success",
        details: expect.objectContaining({ actor_role: "suporte" }),
      }),
    );
    expect(getDashboardSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
