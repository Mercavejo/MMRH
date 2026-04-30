import { describe, expect, it } from "vitest";
import {
  buildPlaytestEvidencePackage,
  filterAdminEventsByActorSession,
  formatPlaytestEvidencePackageAsMarkdown,
} from "@/lib/observability/playtest-evidence";
import type { AuditEventRecord } from "@/modules/audit/domain/audit-event-filters";

describe("playtest evidence", () => {
  it("groups technical events by step and correlation id", () => {
    const events: AuditEventRecord[] = [
      {
        id: "1",
        action: "playtest.rh.dashboard.view",
        status: "success",
        resource_type: "dashboard",
        resource_id: "client_dashboard",
        actor_id: "actor-1",
        correlation_id: "corr-dashboard",
        created_at: "2026-04-28T10:00:00.000Z",
        details: { latest_batch_id: "batch-1" },
      },
      {
        id: "2",
        action: "playtest.rh.batches.import",
        status: "success",
        resource_type: "batches",
        resource_id: "batch-1",
        actor_id: "actor-1",
        correlation_id: "corr-upload",
        created_at: "2026-04-28T10:01:00.000Z",
        details: { batch_id: "batch-1" },
      },
      {
        id: "3",
        action: "playtest.rh.batches.history.view",
        status: "success",
        resource_type: "batches",
        resource_id: "batch-1",
        actor_id: "actor-1",
        correlation_id: "corr-history",
        created_at: "2026-04-28T10:02:00.000Z",
        details: { batch_id: "batch-1" },
      },
      {
        id: "4",
        action: "playtest.rh.support.case.friction",
        status: "failure",
        resource_type: "support_case",
        resource_id: "case-1",
        actor_id: "actor-1",
        correlation_id: "corr-support",
        created_at: "2026-04-28T10:03:00.000Z",
        details: { cause: "domain_error", case_id: "case-1", batch_id: "batch-1" },
      },
      {
        id: "5",
        action: "playtest.employee.docs.view",
        status: "success",
        resource_type: "employee_documents",
        resource_id: "document-list",
        actor_id: "actor-2",
        correlation_id: "corr-docs",
        created_at: "2026-04-28T10:04:00.000Z",
        details: { user_id: "actor-2", document_id: "doc-1" },
      },
    ];

    const pkg = buildPlaytestEvidencePackage({
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionLabel: "sessao-demo",
      events,
      generatedAt: "2026-04-28T10:10:00.000Z",
    });

    expect(pkg.covered_steps).toEqual([
      "dashboard_cliente",
      "upload_lote",
      "historico_envio",
      "suporte",
      "troca_para_colaborador",
    ]);
    expect(pkg.missing_steps).toEqual([]);
    expect(pkg.evidences[3]).toEqual(
      expect.objectContaining({
        step: "suporte",
        friction_level: "medium",
        correlation_id: "corr-support",
        classification: "gap_observabilidade",
        support_refs: expect.objectContaining({ case_id: "case-1", batch_id: "batch-1" }),
      }),
    );
  });

  it("renders markdown package with missing steps summary", () => {
    const pkg = buildPlaytestEvidencePackage({
      tenantId: "tenant-1",
      actorId: "actor-1",
      sessionLabel: "sessao-reduzida",
      generatedAt: "2026-04-28T10:10:00.000Z",
      events: [
        {
          id: "1",
          action: "playtest.rh.dashboard.friction",
          status: "failure",
          resource_type: "dashboard",
          resource_id: "client_dashboard",
          actor_id: "actor-1",
          correlation_id: "corr-dashboard",
          created_at: "2026-04-28T10:00:00.000Z",
          details: { cause: "internal_error" },
        },
      ],
    });

    const markdown = formatPlaytestEvidencePackageAsMarkdown(pkg);

    expect(markdown).toContain("# Pacote de Evidencias de Playtesting");
    expect(markdown).toContain("Clareza do dashboard cliente");
    expect(markdown).toContain("Etapas ainda sem evidencia");
    expect(markdown).toContain("Upload e processamento inicial do lote");
  });

  it("builds admin package separated by role without dropping multi-role session evidence", () => {
    const pkg = buildPlaytestEvidencePackage({
      tenantId: "tenant-1",
      sessionLabel: "sessao-admin",
      mode: "admin",
      generatedAt: "2026-04-28T10:10:00.000Z",
      events: [
        {
          id: "1",
          action: "playtest.rh.dashboard.internal.view",
          status: "success",
          resource_type: "dashboard",
          resource_id: "internal_dashboard",
          actor_id: "admin-1",
          correlation_id: "corr-admin-dashboard",
          created_at: "2026-04-28T10:00:00.000Z",
          details: { actor_role: "admin_plataforma" },
        },
        {
          id: "2",
          action: "playtest.rh.support.case.view",
          status: "success",
          resource_type: "support_case",
          resource_id: "case-1",
          actor_id: "support-1",
          correlation_id: "corr-support-view",
          created_at: "2026-04-28T10:02:00.000Z",
          details: { actor_role: "suporte", case_id: "case-1", batch_id: "batch-1" },
        },
        {
          id: "3",
          action: "playtest.rh.boundary.gestor.blocked",
          status: "success",
          resource_type: "audit",
          resource_id: "/api/v1/audit-events",
          actor_id: "gestor-1",
          correlation_id: "corr-boundary",
          created_at: "2026-04-28T10:03:00.000Z",
          details: { actor_role: "rh_gestor", resource_path: "/api/v1/audit-events" },
        },
      ],
    });

    expect(pkg.mode).toBe("admin");
    expect(pkg.covered_steps).toEqual([
      "dashboard_interno",
      "consolidacao_suporte",
      "fronteira_negativa_gestor",
    ]);
    expect(pkg.evidences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: "dashboard_interno", role: "admin_plataforma" }),
        expect.objectContaining({ step: "consolidacao_suporte", role: "suporte" }),
        expect.objectContaining({
          step: "fronteira_negativa_gestor",
          role: "rh_gestor",
          friction_level: "none",
          classification: "ok",
        }),
      ]),
    );
  });

  it("preserves multi-role admin session evidence when filtering by actor", () => {
    const events: AuditEventRecord[] = [
      {
        id: "1",
        action: "playtest.rh.dashboard.internal.view",
        status: "success",
        resource_type: "dashboard",
        resource_id: "internal_dashboard",
        actor_id: "admin-1",
        correlation_id: "corr-admin",
        created_at: "2026-04-28T10:00:00.000Z",
        details: { actor_role: "admin_plataforma" },
      },
      {
        id: "2",
        action: "playtest.rh.support.case.view",
        status: "success",
        resource_type: "support_case",
        resource_id: "case-1",
        actor_id: "support-1",
        correlation_id: "corr-admin",
        created_at: "2026-04-28T10:01:00.000Z",
        details: { actor_role: "suporte", case_id: "case-1" },
      },
      {
        id: "3",
        action: "playtest.rh.boundary.gestor.blocked",
        status: "success",
        resource_type: "audit",
        resource_id: "/api/v1/audit-events",
        actor_id: "gestor-1",
        correlation_id: "corr-admin",
        created_at: "2026-04-28T10:02:00.000Z",
        details: { actor_role: "rh_gestor", resource_path: "/api/v1/audit-events" },
      },
    ];

    const filtered = filterAdminEventsByActorSession(events, "admin-1");
    const pkg = buildPlaytestEvidencePackage({
      tenantId: "tenant-1",
      sessionLabel: "sessao-admin-filtrada",
      mode: "admin",
      actorId: "admin-1",
      events: filtered,
    });

    expect(filtered).toHaveLength(3);
    expect(pkg.covered_steps).toEqual([
      "dashboard_interno",
      "consolidacao_suporte",
      "fronteira_negativa_gestor",
    ]);
  });

  it("ignores gestor support access in admin package role separation", () => {
    const pkg = buildPlaytestEvidencePackage({
      tenantId: "tenant-1",
      sessionLabel: "sessao-admin-com-gestor",
      mode: "admin",
      generatedAt: "2026-04-28T10:10:00.000Z",
      events: [
        {
          id: "1",
          action: "playtest.rh.support.case.view",
          status: "success",
          resource_type: "support_case",
          resource_id: "case-1",
          actor_id: "gestor-1",
          correlation_id: "corr-gestor-support",
          created_at: "2026-04-28T10:00:00.000Z",
          details: { actor_role: "rh_gestor", case_id: "case-1" },
        },
        {
          id: "2",
          action: "playtest.rh.boundary.gestor.blocked",
          status: "success",
          resource_type: "audit",
          resource_id: "/api/v1/rh/indicators",
          actor_id: "gestor-1",
          correlation_id: "corr-gestor-boundary",
          created_at: "2026-04-28T10:01:00.000Z",
          details: { actor_role: "rh_gestor", resource_path: "/api/v1/rh/indicators" },
        },
      ],
    });

    expect(pkg.covered_steps).toEqual(["fronteira_negativa_gestor"]);
    expect(pkg.evidences).toEqual([
      expect.objectContaining({
        step: "fronteira_negativa_gestor",
        role: "rh_gestor",
      }),
    ]);
  });
});
