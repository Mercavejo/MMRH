import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import type { AuditEventRecord } from "@/modules/audit/domain/audit-event-filters";

type DbLike = typeof db;

export const PLAYTEST_EVIDENCE_STEPS = [
  "dashboard_cliente",
  "upload_lote",
  "historico_envio",
  "suporte",
  "troca_para_colaborador",
  "dashboard_interno",
  "indicadores_alertas",
  "fila_excecoes",
  "auditoria_operacional",
  "consolidacao_suporte",
  "fronteira_negativa_gestor",
] as const;

export type PlaytestEvidenceStep = (typeof PLAYTEST_EVIDENCE_STEPS)[number];
export type PlaytestFrictionLevel = "none" | "low" | "medium" | "high";
export type PlaytestEvidenceMode = "client" | "admin";
export type PlaytestEvidenceRole =
  | "gestor_cliente"
  | "colaborador"
  | "admin_plataforma"
  | "suporte"
  | "rh_gestor"
  | "rh_operator"
  | "desconhecido";
export type PlaytestEvidenceClassification =
  | "ok"
  | "melhoria"
  | "gap_observabilidade"
  | "bloqueador";

export type PlaytestEvidenceEntry = {
  step: PlaytestEvidenceStep;
  role: PlaytestEvidenceRole;
  expected_result: string;
  observed_result: string;
  friction_level: PlaytestFrictionLevel;
  classification: PlaytestEvidenceClassification;
  correlation_id: string;
  support_refs: {
    batch_id: string | null;
    document_id: string | null;
    case_id: string | null;
    user_id: string | null;
  };
  technical_actions: string[];
  suggested_action: string;
};

export type PlaytestEvidencePackage = {
  generated_at: string;
  mode: PlaytestEvidenceMode;
  tenant_id: string;
  actor_id: string | null;
  role_filter: PlaytestEvidenceRole | null;
  session_label: string;
  total_events: number;
  covered_steps: PlaytestEvidenceStep[];
  missing_steps: PlaytestEvidenceStep[];
  evidences: PlaytestEvidenceEntry[];
};

export type PlaytestHumanEvidenceEntry = {
  source: "human";
  source_label: string;
  mode: PlaytestEvidenceMode;
  step: PlaytestEvidenceStep;
  role: PlaytestEvidenceRole;
  expected_result: string;
  observed_result: string;
  friction_level: PlaytestFrictionLevel;
  classification: PlaytestEvidenceClassification;
  correlation_id: string;
  support_refs: PlaytestEvidenceEntry["support_refs"];
  suggested_action: string;
};

const HUMAN_STEP_ALIASES = {
  comparativo_colaborador: "troca_para_colaborador",
} as const;

export type PlaytestTriageFinalCategory =
  | "bloqueador"
  | "melhoria_antes_da_proxima_demo"
  | "futuro_backlog";

export type PlaytestBacklogWorkType = "bug" | "hardening" | "nova_funcionalidade";

export type PlaytestTriageBacklogItem = {
  title: string;
  final_category: PlaytestTriageFinalCategory;
  work_type: PlaytestBacklogWorkType;
  summary: string;
  impact_summary: string;
  suggested_next_action: string;
  triage_reason: string;
  source_types: Array<"human" | "technical">;
  evidence_sources: string[];
  affected_roles: PlaytestEvidenceRole[];
  affected_steps: PlaytestEvidenceStep[];
  correlation_ids: string[];
  support_refs: {
    batch_ids: string[];
    document_ids: string[];
    case_ids: string[];
    user_ids: string[];
  };
};

export type PlaytestTriageReport = {
  generated_at: string;
  round_label: string;
  summary: {
    counts: Record<PlaytestTriageFinalCategory, number>;
    missing_evidence_steps: PlaytestEvidenceStep[];
    top_friction_roles: Array<{
      role: PlaytestEvidenceRole;
      total_findings: number;
    }>;
  };
  backlog_items: PlaytestTriageBacklogItem[];
};

export type PlaytestDecisionRecommendation = "go" | "fix" | "defer";
export type PlaytestDecisionNextCycleAction =
  | "seguir implementacao"
  | "corrigir bloqueadores"
  | "adiar expansoes";

export type PlaytestDecisionGate = {
  recommendation: PlaytestDecisionRecommendation;
  executive_summary: string;
  decision_factors: string[];
  supporting_backlog_items: PlaytestTriageBacklogItem[];
  next_cycle_action: PlaytestDecisionNextCycleAction;
};

export type PlaytestDecisionGateValidationIssue = {
  code: "example_round_label" | "template_evidence_source";
  message: string;
};

const CRITICAL_DECISION_STEPS: PlaytestEvidenceStep[] = [
  "dashboard_cliente",
  "upload_lote",
  "historico_envio",
  "suporte",
  "fronteira_negativa_gestor",
];

export function filterAdminEventsByActorSession(
  events: AuditEventRecord[],
  actorId: string,
): AuditEventRecord[] {
  const actorCorrelationIds = new Set(
    events
      .filter((event) => event.actor_id === actorId)
      .map((event) => event.correlation_id),
  );

  if (actorCorrelationIds.size === 0) {
    return [];
  }

  return events.filter((event) => actorCorrelationIds.has(event.correlation_id));
}

const CLIENT_STEP_ORDER: PlaytestEvidenceStep[] = [
  "dashboard_cliente",
  "upload_lote",
  "historico_envio",
  "suporte",
  "troca_para_colaborador",
];

const ADMIN_STEP_ORDER: PlaytestEvidenceStep[] = [
  "dashboard_interno",
  "indicadores_alertas",
  "fila_excecoes",
  "auditoria_operacional",
  "consolidacao_suporte",
  "fronteira_negativa_gestor",
];

const STEP_CONFIG: Record<
  PlaytestEvidenceStep,
  {
    mode: PlaytestEvidenceMode;
    role: PlaytestEvidenceRole;
    expected_result: string;
    label: string;
  }
> = {
  dashboard_cliente: {
    mode: "client",
    role: "gestor_cliente",
    label: "Clareza do dashboard cliente",
    expected_result: "Dashboard cliente carrega resumo funcional do ultimo envio sem expor areas internas.",
  },
  upload_lote: {
    mode: "client",
    role: "gestor_cliente",
    label: "Upload e processamento inicial do lote",
    expected_result: "Gestor envia lote e recebe retorno funcional claro sobre validacao/importacao.",
  },
  historico_envio: {
    mode: "client",
    role: "gestor_cliente",
    label: "Historico funcional do envio",
    expected_result: "Gestor consulta andamento do lote com status funcional e proximos passos.",
  },
  suporte: {
    mode: "client",
    role: "gestor_cliente",
    label: "Abertura ou consulta de suporte",
    expected_result: "Gestor consegue consultar suporte vinculado ao caso sem acessar observabilidade interna.",
  },
  troca_para_colaborador: {
    mode: "client",
    role: "colaborador",
    label: "Troca de visao para colaborador",
    expected_result: "Colaborador visualiza apenas os proprios documentos e permanece isolado do contexto RH.",
  },
  dashboard_interno: {
    mode: "admin",
    role: "admin_plataforma",
    label: "Dashboard interno",
    expected_result: "Dashboard interno carrega leitura operacional consolidada sem depender do roteiro cliente.",
  },
  indicadores_alertas: {
    mode: "admin",
    role: "admin_plataforma",
    label: "Indicadores e alertas operacionais",
    expected_result: "Indicadores e alertas carregam com filtros e trilha tecnica coerentes para operacao interna.",
  },
  fila_excecoes: {
    mode: "admin",
    role: "admin_plataforma",
    label: "Fila de excecoes",
    expected_result: "Fila de excecoes exibe pendencias operacionais sem entrar na jornada cliente.",
  },
  auditoria_operacional: {
    mode: "admin",
    role: "admin_plataforma",
    label: "Auditoria operacional",
    expected_result: "Auditoria mostra timeline, filtros e eventos coerentes por tenant para uso interno.",
  },
  consolidacao_suporte: {
    mode: "admin",
    role: "suporte",
    label: "Consolidacao tecnica de suporte",
    expected_result: "Caso tecnico pode ser investigado por admin/suporte sem vazar escopo de cliente.",
  },
  fronteira_negativa_gestor: {
    mode: "admin",
    role: "rh_gestor",
    label: "Fronteira negativa do gestor",
    expected_result: "Gestor cliente nao visualiza nem acessa areas admin por menu, rota ou payload.",
  },
};

function mapAuditRecord(row: {
  id: string;
  action: string;
  status: "success" | "failure";
  resourceType: string;
  resourceId: string;
  actorId: string | null;
  correlationId: string;
  createdAt: Date;
  details: Record<string, unknown> | null;
}): AuditEventRecord {
  return {
    id: row.id,
    action: row.action,
    status: row.status,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    actor_id: row.actorId,
    correlation_id: row.correlationId,
    created_at: row.createdAt.toISOString(),
    details: row.details,
  };
}

function readString(details: Record<string, unknown> | null, key: string): string | null {
  if (!details) {
    return null;
  }

  const value = details[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function inferStep(action: string): PlaytestEvidenceStep | null {
  if (action.startsWith("playtest.rh.dashboard.internal.")) {
    return "dashboard_interno";
  }

  if (action.startsWith("playtest.rh.dashboard.")) {
    return "dashboard_cliente";
  }

  if (action === "playtest.rh.batches.import" || action === "playtest.rh.batches.friction") {
    return "upload_lote";
  }

  if (action === "playtest.rh.batches.history.view" || action === "playtest.rh.batches.history.friction") {
    return "historico_envio";
  }

  if (action === "playtest.employee.docs.view" || action === "playtest.employee.docs.friction") {
    return "troca_para_colaborador";
  }

  if (action === "playtest.rh.indicators.view" || action === "playtest.rh.indicators.friction") {
    return "indicadores_alertas";
  }

  if (action === "playtest.rh.alerts.view" || action === "playtest.rh.alerts.friction") {
    return "indicadores_alertas";
  }

  if (action === "playtest.rh.exceptions.queue.view" || action === "playtest.rh.exceptions.queue.friction") {
    return "fila_excecoes";
  }

  if (action === "playtest.rh.audit.view" || action === "playtest.rh.audit.friction") {
    return "auditoria_operacional";
  }

  if (
    action === "playtest.rh.support.case.view" ||
    action === "playtest.rh.support.case.friction"
  ) {
    return "suporte";
  }

  if (
    action === "playtest.rh.boundary.gestor.blocked" ||
    action === "playtest.rh.boundary.gestor.leak"
  ) {
    return "fronteira_negativa_gestor";
  }

  return null;
}

function inferFrictionLevel(event: AuditEventRecord): PlaytestFrictionLevel {
  if (event.action === "playtest.rh.boundary.gestor.blocked") {
    return "none";
  }

  if (event.action === "playtest.rh.boundary.gestor.leak") {
    return "high";
  }

  if (event.status === "success") {
    return "none";
  }

  const cause = readString(event.details, "cause");
  if (cause === "unauthorized" || cause === "forbidden" || cause === "capability_forbidden") {
    return "high";
  }

  if (cause === "internal_error" || cause === "domain_error" || cause === "file_validation") {
    return "medium";
  }

  return "low";
}

function inferClassification(
  event: AuditEventRecord,
  level: PlaytestFrictionLevel,
): PlaytestEvidenceClassification {
  if (event.action === "playtest.rh.boundary.gestor.blocked") {
    return "ok";
  }

  if (event.action === "playtest.rh.boundary.gestor.leak") {
    return "bloqueador";
  }

  const cause = readString(event.details, "cause");
  if (cause === "instrumentation_missing") {
    return "gap_observabilidade";
  }

  if (level === "none") {
    return "ok";
  }

  if (level === "high") {
    return "bloqueador";
  }

  if (level === "medium") {
    return "gap_observabilidade";
  }

  return "melhoria";
}

function inferRole(
  event: AuditEventRecord,
  step: PlaytestEvidenceStep,
): PlaytestEvidenceRole {
  const actorRole = readString(event.details, "actor_role");
  if (
    actorRole === "gestor_cliente" ||
    actorRole === "colaborador" ||
    actorRole === "admin_plataforma" ||
    actorRole === "suporte" ||
    actorRole === "rh_gestor" ||
    actorRole === "rh_operator"
  ) {
    return actorRole;
  }

  if (step === "troca_para_colaborador") {
    return "colaborador";
  }

  if (step === "fronteira_negativa_gestor") {
    return "rh_gestor";
  }

  return STEP_CONFIG[step].role;
}

function resolveStepForMode(
  event: AuditEventRecord,
  mode: PlaytestEvidenceMode,
): PlaytestEvidenceStep | null {
  const rawStep = inferStep(event.action);
  if (!rawStep) {
    return null;
  }

  if (mode === "admin") {
    if (rawStep === "dashboard_cliente" && event.action.startsWith("playtest.rh.dashboard.internal.")) {
      return "dashboard_interno";
    }

    if (rawStep === "suporte") {
      const role = inferRole(event, rawStep);
      if (role === "rh_gestor" || role === "gestor_cliente" || role === "colaborador") {
        return null;
      }
      return "consolidacao_suporte";
    }
  }

  if (mode === "client" && rawStep === "consolidacao_suporte") {
    return "suporte";
  }

  return rawStep;
}

function describeObservedResult(step: PlaytestEvidenceStep, event: AuditEventRecord): string {
  const cause = readString(event.details, "cause");
  const reason = readString(event.details, "reason");

  if (event.status === "success") {
    switch (step) {
      case "dashboard_cliente":
        return "Dashboard cliente carregado com resumo funcional disponivel.";
      case "upload_lote":
        return "Upload validado com retorno funcional do lote.";
      case "historico_envio":
        return "Historico do lote consultado com status funcional.";
      case "suporte":
        return "Consulta de suporte retornou consolidacao do caso.";
      case "troca_para_colaborador":
        return "Consulta de documentos do colaborador retornou somente itens do proprio usuario.";
      case "dashboard_interno":
        return "Dashboard interno carregado com leitura operacional consolidada.";
      case "indicadores_alertas":
        return "Indicadores e alertas operacionais retornaram com dados do tenant.";
      case "fila_excecoes":
        return "Fila de excecoes retornou pendencias operacionais do lote.";
      case "auditoria_operacional":
        return "Auditoria interna retornou eventos e timeline coerentes para investigacao.";
      case "consolidacao_suporte":
        return "Consolidacao tecnica do caso retornou links e historico para investigacao.";
      case "fronteira_negativa_gestor":
        return "Acesso do gestor a area admin foi bloqueado como esperado.";
    }
  }

  if (reason) {
    return `Fluxo apresentou friccao: ${reason}.`;
  }

  if (cause) {
    return `Fluxo apresentou friccao tecnica: ${cause}.`;
  }

  return "Fluxo apresentou friccao sem detalhe adicional.";
}

function describeSuggestedAction(level: PlaytestFrictionLevel): string {
  if (level === "none") {
    return "Nenhuma acao corretiva imediata.";
  }

  if (level === "low") {
    return "Registrar observacao e revalidar em nova sessao.";
  }

  if (level === "medium") {
    return "Corrigir antes da proxima rodada de playtesting.";
  }

  return "Tratar como bloqueador da jornada cliente.";
}

function extractSupportRefs(events: AuditEventRecord[]) {
  const detailsList = events.map((event) => event.details);

  return {
    batch_id:
      events.find((event) => event.resource_type === "batch")?.resource_id ??
      detailsList.map((details) => readString(details, "batch_id")).find(Boolean) ??
      null,
    document_id:
      events.find((event) => event.resource_type === "document")?.resource_id ??
      detailsList.map((details) => readString(details, "document_id")).find(Boolean) ??
      null,
    case_id:
      events.find((event) => event.resource_type === "support_case")?.resource_id ??
      detailsList.map((details) => readString(details, "case_id")).find(Boolean) ??
      null,
    user_id:
      events.find((event) => event.actor_id)?.actor_id ??
      detailsList.map((details) => readString(details, "user_id")).find(Boolean) ??
      null,
  };
}

export async function listPlaytestAuditEvents(input: {
  tenantId: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  correlationId?: string;
}, dbClient: DbLike = db): Promise<AuditEventRecord[]> {
  const conditions = [eq(auditLogs.tenantId, input.tenantId)];

  if (input.actorId) {
    conditions.push(eq(auditLogs.actorId, input.actorId));
  }

  if (input.correlationId) {
    conditions.push(eq(auditLogs.correlationId, input.correlationId));
  }

  if (input.from) {
    conditions.push(gte(auditLogs.createdAt, input.from));
  }

  if (input.to) {
    conditions.push(lte(auditLogs.createdAt, input.to));
  }

  const rows = await dbClient
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      status: auditLogs.status,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      actorId: auditLogs.actorId,
      correlationId: auditLogs.correlationId,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id))
    .limit(500);

  return rows
    .map(mapAuditRecord)
    .filter((event) => event.action.startsWith("playtest.") && inferStep(event.action) !== null);
}

export function buildPlaytestEvidencePackage(input: {
  generatedAt?: string;
  tenantId: string;
  actorId?: string | null;
  mode?: PlaytestEvidenceMode;
  roleFilter?: PlaytestEvidenceRole;
  sessionLabel: string;
  events: AuditEventRecord[];
}): PlaytestEvidencePackage {
  const mode = input.mode ?? "client";
  const stepOrder = mode === "admin" ? ADMIN_STEP_ORDER : CLIENT_STEP_ORDER;
  const grouped = new Map<string, { step: PlaytestEvidenceStep; events: AuditEventRecord[] }>();

  for (const event of input.events) {
    const step = resolveStepForMode(event, mode);
    if (!step || STEP_CONFIG[step].mode !== mode) {
      continue;
    }

    const role = inferRole(event, step);
    if (input.roleFilter && role !== input.roleFilter) {
      continue;
    }

    const key = `${step}:${role}:${event.correlation_id}`;
    const current = grouped.get(key);
    if (current) {
      current.events.push(event);
      continue;
    }

    grouped.set(key, { step, events: [event] });
  }

  const evidences = [...grouped.values()]
    .map(({ step, events }) => {
      const orderedEvents = [...events].sort(
        (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      );
      const finalEvent = orderedEvents[orderedEvents.length - 1];
      const frictionLevel = inferFrictionLevel(finalEvent);
      const role = inferRole(finalEvent, step);

      return {
        step,
        role,
        expected_result: STEP_CONFIG[step].expected_result,
        observed_result: describeObservedResult(step, finalEvent),
        friction_level: frictionLevel,
        classification: inferClassification(finalEvent, frictionLevel),
        correlation_id: finalEvent.correlation_id,
        support_refs: extractSupportRefs(orderedEvents),
        technical_actions: orderedEvents.map((event) => event.action),
        suggested_action: describeSuggestedAction(frictionLevel),
      } satisfies PlaytestEvidenceEntry;
    })
    .sort(
      (left, right) =>
        stepOrder.indexOf(left.step) - stepOrder.indexOf(right.step) ||
        left.role.localeCompare(right.role) ||
        left.correlation_id.localeCompare(right.correlation_id),
    );

  const coveredSteps = [...new Set(evidences.map((entry) => entry.step))];
  const missingSteps = stepOrder.filter((step) => !coveredSteps.includes(step));

  return {
    generated_at: input.generatedAt ?? new Date().toISOString(),
    mode,
    tenant_id: input.tenantId,
    actor_id: input.actorId ?? null,
    role_filter: input.roleFilter ?? null,
    session_label: input.sessionLabel,
    total_events: input.events.length,
    covered_steps: coveredSteps,
    missing_steps: missingSteps,
    evidences,
  };
}

export function formatPlaytestEvidencePackageAsMarkdown(pkg: PlaytestEvidencePackage): string {
  const lines: string[] = [];

  lines.push("# Pacote de Evidencias de Playtesting");
  lines.push("");
  lines.push(`- Modo: ${pkg.mode}`);
  lines.push(`- Sessao: ${pkg.session_label}`);
  lines.push(`- Tenant: \`${pkg.tenant_id}\``);
  lines.push(`- Ator: ${pkg.actor_id ? `\`${pkg.actor_id}\`` : "nao informado"}`);
  lines.push(`- Filtro de papel: ${pkg.role_filter ?? "todos"}`);
  lines.push(`- Gerado em: ${pkg.generated_at}`);
  lines.push(`- Eventos tecnicos consolidados: ${pkg.total_events}`);
  lines.push(`- Etapas cobertas: ${pkg.covered_steps.length}/${pkg.covered_steps.length + pkg.missing_steps.length}`);
  lines.push("");

  if (pkg.missing_steps.length > 0) {
    lines.push("## Etapas ainda sem evidencia");
    lines.push("");
    for (const step of pkg.missing_steps) {
      lines.push(`- ${STEP_CONFIG[step].label}`);
    }
    lines.push("");
  }

  lines.push("## Evidencias");
  lines.push("");

  for (const entry of pkg.evidences) {
    lines.push(`### ${STEP_CONFIG[entry.step].label}`);
    lines.push("");
    lines.push(`- Papel: ${entry.role}`);
    lines.push(`- Resultado esperado: ${entry.expected_result}`);
    lines.push(`- Resultado observado: ${entry.observed_result}`);
    lines.push(`- Nivel de friccao: ${entry.friction_level}`);
    lines.push(`- Classificacao: ${entry.classification}`);
    lines.push(`- Correlation ID: \`${entry.correlation_id}\``);
    lines.push(
      `- Links/IDs de apoio: batch=${entry.support_refs.batch_id ?? "n/a"}, document=${entry.support_refs.document_id ?? "n/a"}, case=${entry.support_refs.case_id ?? "n/a"}, user=${entry.support_refs.user_id ?? "n/a"}`,
    );
    lines.push(`- Acoes tecnicas: ${entry.technical_actions.join(", ")}`);
    lines.push(`- Acao sugerida: ${entry.suggested_action}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

type NormalizedTriageSource = {
  source: "human" | "technical";
  source_label: string;
  mode: PlaytestEvidenceMode;
  step: PlaytestEvidenceStep;
  role: PlaytestEvidenceRole;
  expected_result: string;
  observed_result: string;
  friction_level: PlaytestFrictionLevel;
  classification: PlaytestEvidenceClassification;
  correlation_id: string;
  support_refs: PlaytestEvidenceEntry["support_refs"];
  suggested_action: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSorted<T extends string>(values: Array<T | null | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => Boolean(value)))].sort();
}

function isScopeLeak(entry: Pick<NormalizedTriageSource, "step" | "role" | "observed_result">): boolean {
  if (entry.step !== "fronteira_negativa_gestor" || entry.role !== "rh_gestor") {
    return false;
  }

  const observed = normalizeText(entry.observed_result);
  return (
    observed.includes("menu admin") ||
    observed.includes("payload admin") ||
    observed.includes("area admin") ||
    observed.includes("rota interna") ||
    observed.includes("indicadores") ||
    observed.includes("auditoria") ||
    observed.includes("excecoes") ||
    observed.includes("apareceu")
  );
}

function inferFinalCategory(entry: NormalizedTriageSource): PlaytestTriageFinalCategory | null {
  if (isScopeLeak(entry)) {
    return "bloqueador";
  }

  if (entry.classification === "ok") {
    return null;
  }

  if (entry.classification === "bloqueador") {
    return "bloqueador";
  }

  if (entry.classification === "gap_observabilidade") {
    if (entry.friction_level === "high" || entry.step === "fronteira_negativa_gestor") {
      return "bloqueador";
    }

    return "melhoria_antes_da_proxima_demo";
  }

  return entry.friction_level === "medium"
    ? "melhoria_antes_da_proxima_demo"
    : "futuro_backlog";
}

function inferWorkType(entry: NormalizedTriageSource, finalCategory: PlaytestTriageFinalCategory): PlaytestBacklogWorkType {
  const combinedText = normalizeText(`${entry.observed_result} ${entry.suggested_action}`);

  if (
    combinedText.includes("destino nova_funcionalidade") ||
    combinedText.includes("destino=nova_funcionalidade") ||
    combinedText.includes("nova funcionalidade")
  ) {
    return "nova_funcionalidade";
  }

  if (entry.classification === "gap_observabilidade") {
    return "hardening";
  }

  if (
    combinedText.includes("adicionar ") ||
    combinedText.includes("comparativo ") ||
    combinedText.includes("exportacao ") ||
    combinedText.includes("exportar ")
  ) {
    return "nova_funcionalidade";
  }

  if (finalCategory === "bloqueador" || isScopeLeak(entry) || entry.friction_level === "high") {
    return "bug";
  }

  return "hardening";
}

function buildItemTitle(entry: NormalizedTriageSource, workType: PlaytestBacklogWorkType): string {
  const label = STEP_CONFIG[entry.step].label;

  if (workType === "bug") {
    return `${label}: corrigir falha confirmada`;
  }

  if (workType === "nova_funcionalidade") {
    return `${label}: avaliar expansao solicitada`;
  }

  return `${label}: reforcar confianca operacional`;
}

function buildTriageReason(entry: NormalizedTriageSource, finalCategory: PlaytestTriageFinalCategory): string {
  if (isScopeLeak(entry)) {
    return "Vazamento de escopo para rh_gestor sempre escala para bloqueador.";
  }

  if (entry.classification === "gap_observabilidade") {
    return finalCategory === "bloqueador"
      ? "Gap de observabilidade compromete confianca da rodada atual."
      : "Gap de observabilidade exige correcao antes da proxima demo.";
  }

  if (entry.classification === "bloqueador") {
    return "Falha confirmada impede continuidade segura da rodada.";
  }

  return finalCategory === "melhoria_antes_da_proxima_demo"
    ? "Melhoria com impacto imediato no proximo ciclo de demo."
    : "Melhoria valida, mas sem impacto bloqueante no MVP atual.";
}

function normalizeTechnicalSources(packages: PlaytestEvidencePackage[]): NormalizedTriageSource[] {
  return packages.flatMap((pkg) =>
    pkg.evidences.map((entry) => ({
      source: "technical" as const,
      source_label: `${pkg.mode}::${pkg.session_label}`,
      mode: pkg.mode,
      step: entry.step,
      role: entry.role,
      expected_result: entry.expected_result,
      observed_result: entry.observed_result,
      friction_level: entry.friction_level,
      classification: entry.classification,
      correlation_id: entry.correlation_id,
      support_refs: entry.support_refs,
      suggested_action: entry.suggested_action,
    })),
  );
}

function parseSupportRefs(raw: string): PlaytestEvidenceEntry["support_refs"] {
  const refs: PlaytestEvidenceEntry["support_refs"] = {
    batch_id: null,
    document_id: null,
    case_id: null,
    user_id: null,
  };

  for (const match of raw.matchAll(/(batch_id|document_id|case_id|user_id)\s*=\s*`?([^`\/;|]+?)`?(?=\s*(?:\/|;|\||$))/g)) {
    const key = match[1] as keyof typeof refs;
    const value = match[2]?.trim();
    if (value && !value.startsWith("copiar_do") && value !== "opcional") {
      refs[key] = value;
    }
  }

  return refs;
}

function inferHumanClassification(input: {
  mode: PlaytestEvidenceMode;
  step: PlaytestEvidenceStep;
  role: PlaytestEvidenceRole;
  observedResult: string;
  frictionLevel: PlaytestFrictionLevel;
  explicitClassification?: string;
  suggestedAction: string;
}): PlaytestEvidenceClassification {
  const explicit = input.explicitClassification?.trim();
  if (
    explicit === "ok" ||
    explicit === "melhoria" ||
    explicit === "gap_observabilidade" ||
    explicit === "bloqueador"
  ) {
    return explicit;
  }

  if (
    isScopeLeak({
      step: input.step,
      role: input.role,
      observed_result: input.observedResult,
    })
  ) {
    return "bloqueador";
  }

  const combined = normalizeText(`${input.observedResult} ${input.suggestedAction}`);
  if (
    combined.includes("correlation id") ||
    combined.includes("correlation_id") ||
    combined.includes("trilha tecnica") ||
    combined.includes("observabilidade") ||
    combined.includes("instrumentacao")
  ) {
    return "gap_observabilidade";
  }

  if (input.frictionLevel === "high") {
    return "bloqueador";
  }

  if (input.frictionLevel === "medium") {
    return "gap_observabilidade";
  }

  if (input.frictionLevel === "none") {
    return "ok";
  }

  return "melhoria";
}

export function parsePlaytestEvidenceMarkdown(
  markdown: string,
  input: {
    mode: PlaytestEvidenceMode;
    sourceLabel: string;
  },
): PlaytestHumanEvidenceEntry[] {
  const entries: PlaytestHumanEvidenceEntry[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentSection: "evidence" | "model" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      if (trimmed === "## Evidencias por etapa") {
        currentSection = "evidence";
      } else if (trimmed === "## Sessao modelo") {
        currentSection = "model";
      } else {
        currentSection = null;
      }
      continue;
    }

    if (!trimmed.startsWith("|")) {
      continue;
    }

    if (currentSection === "model") {
      continue;
    }

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 8 || cells[0] === "etapa" || /^-+$/.test(cells[0].replace(/\s+/g, ""))) {
      continue;
    }

    const rawStep = cells[0];
    const step = (
      HUMAN_STEP_ALIASES[rawStep as keyof typeof HUMAN_STEP_ALIASES] ?? rawStep
    ) as PlaytestEvidenceStep;
    const role = cells[1] as PlaytestEvidenceRole;
    if (!PLAYTEST_EVIDENCE_STEPS.includes(step)) {
      continue;
    }

    const observedResult = cells[3] ?? "";
    if (!observedResult || observedResult === "") {
      continue;
    }

    const frictionLevel = cells[4] as PlaytestFrictionLevel;
    const explicitClassification = input.mode === "admin" ? cells[5] : undefined;
    const correlationId = input.mode === "admin" ? (cells[6] ?? "") : (cells[5] ?? "");
    const refsRaw = input.mode === "admin" ? (cells[7] ?? "") : (cells[6] ?? "");
    const suggestedAction = input.mode === "admin" ? (cells[8] ?? "") : (cells[7] ?? "");

    entries.push({
      source: "human",
      source_label: input.sourceLabel,
      mode: input.mode,
      step,
      role,
      expected_result: cells[2] ?? "",
      observed_result: observedResult,
      friction_level: frictionLevel,
      classification: inferHumanClassification({
        mode: input.mode,
        step,
        role,
        observedResult,
        frictionLevel,
        explicitClassification,
        suggestedAction,
      }),
      correlation_id: correlationId.trim(),
      support_refs: parseSupportRefs(refsRaw),
      suggested_action: suggestedAction,
    });
  }

  return entries;
}

export function buildPlaytestTriageReport(input: {
  roundLabel: string;
  generatedAt?: string;
  technicalPackages?: PlaytestEvidencePackage[];
  humanEntries?: PlaytestHumanEvidenceEntry[];
}): PlaytestTriageReport {
  const sources: NormalizedTriageSource[] = [
    ...normalizeTechnicalSources(input.technicalPackages ?? []),
    ...(input.humanEntries ?? []),
  ];

  const grouped = new Map<
    string,
    {
      title: string;
      final_category: PlaytestTriageFinalCategory;
      work_type: PlaytestBacklogWorkType;
      summaryParts: string[];
      impactParts: string[];
      nextActions: string[];
      reasons: string[];
      sourceTypes: Array<"human" | "technical">;
      evidenceSources: string[];
      roles: PlaytestEvidenceRole[];
      steps: PlaytestEvidenceStep[];
      correlationIds: string[];
      supportRefs: {
        batch_ids: string[];
        document_ids: string[];
        case_ids: string[];
        user_ids: string[];
      };
    }
  >();

  for (const source of sources) {
    const finalCategory = inferFinalCategory(source);
    if (!finalCategory) {
      continue;
    }

    const workType = inferWorkType(source, finalCategory);
    const primaryRef =
      source.correlation_id ||
      source.support_refs.case_id ||
      source.support_refs.batch_id ||
      source.support_refs.document_id ||
      source.support_refs.user_id ||
      `${source.step}:${normalizeText(source.observed_result).slice(0, 48)}`;
    const key = `${finalCategory}:${workType}:${primaryRef}`;
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        title: buildItemTitle(source, workType),
        final_category: finalCategory,
        work_type: workType,
        summaryParts: [source.observed_result],
        impactParts: [`${source.role} em ${STEP_CONFIG[source.step].label}`],
        nextActions: [source.suggested_action],
        reasons: [buildTriageReason(source, finalCategory)],
        sourceTypes: [source.source],
        evidenceSources: [source.source_label],
        roles: [source.role],
        steps: [source.step],
        correlationIds: source.correlation_id ? [source.correlation_id] : [],
        supportRefs: {
          batch_ids: source.support_refs.batch_id ? [source.support_refs.batch_id] : [],
          document_ids: source.support_refs.document_id ? [source.support_refs.document_id] : [],
          case_ids: source.support_refs.case_id ? [source.support_refs.case_id] : [],
          user_ids: source.support_refs.user_id ? [source.support_refs.user_id] : [],
        },
      });
      continue;
    }

    current.summaryParts.push(source.observed_result);
    current.impactParts.push(`${source.role} em ${STEP_CONFIG[source.step].label}`);
    current.nextActions.push(source.suggested_action);
    current.reasons.push(buildTriageReason(source, finalCategory));
    current.sourceTypes.push(source.source);
    current.evidenceSources.push(source.source_label);
    current.roles.push(source.role);
    current.steps.push(source.step);
    if (source.correlation_id) {
      current.correlationIds.push(source.correlation_id);
    }
    if (source.support_refs.batch_id) {
      current.supportRefs.batch_ids.push(source.support_refs.batch_id);
    }
    if (source.support_refs.document_id) {
      current.supportRefs.document_ids.push(source.support_refs.document_id);
    }
    if (source.support_refs.case_id) {
      current.supportRefs.case_ids.push(source.support_refs.case_id);
    }
    if (source.support_refs.user_id) {
      current.supportRefs.user_ids.push(source.support_refs.user_id);
    }
  }

  const backlogItems = [...grouped.values()]
    .map((item) => ({
      title: item.title,
      final_category: item.final_category,
      work_type: item.work_type,
      summary: uniqueSorted(item.summaryParts).join(" "),
      impact_summary: uniqueSorted(item.impactParts).join("; "),
      suggested_next_action: uniqueSorted(item.nextActions).join(" | "),
      triage_reason: uniqueSorted(item.reasons).join(" "),
      source_types: uniqueSorted(item.sourceTypes),
      evidence_sources: uniqueSorted(item.evidenceSources),
      affected_roles: uniqueSorted(item.roles),
      affected_steps: uniqueSorted(item.steps),
      correlation_ids: uniqueSorted(item.correlationIds),
      support_refs: {
        batch_ids: uniqueSorted(item.supportRefs.batch_ids),
        document_ids: uniqueSorted(item.supportRefs.document_ids),
        case_ids: uniqueSorted(item.supportRefs.case_ids),
        user_ids: uniqueSorted(item.supportRefs.user_ids),
      },
    }))
    .sort((left, right) => {
      const categoryOrder: Record<PlaytestTriageFinalCategory, number> = {
        bloqueador: 0,
        melhoria_antes_da_proxima_demo: 1,
        futuro_backlog: 2,
      };

      return (
        categoryOrder[left.final_category] - categoryOrder[right.final_category] ||
        left.work_type.localeCompare(right.work_type) ||
        left.title.localeCompare(right.title)
      );
    });

  const counts: Record<PlaytestTriageFinalCategory, number> = {
    bloqueador: 0,
    melhoria_antes_da_proxima_demo: 0,
    futuro_backlog: 0,
  };

  for (const item of backlogItems) {
    counts[item.final_category] += 1;
  }

  const topFrictionRoles = [...new Map(backlogItems.flatMap((item) => item.affected_roles).map((role) => [role, 0])).keys()]
    .map((role) => ({
      role,
      total_findings: backlogItems.filter((item) => item.affected_roles.includes(role)).length,
    }))
    .sort(
      (left, right) =>
        right.total_findings - left.total_findings || left.role.localeCompare(right.role),
    );

  const modesPresent = new Set<PlaytestEvidenceMode>();
  const coveredSteps = new Set<PlaytestEvidenceStep>();

  for (const pkg of input.technicalPackages ?? []) {
    modesPresent.add(pkg.mode);
    for (const step of pkg.covered_steps) {
      coveredSteps.add(step);
    }
    for (const evidence of pkg.evidences) {
      coveredSteps.add(evidence.step);
    }
  }

  for (const entry of input.humanEntries ?? []) {
    modesPresent.add(entry.mode);
    coveredSteps.add(entry.step);
  }

  const expectedSteps = [...modesPresent].flatMap((mode) =>
    mode === "admin" ? ADMIN_STEP_ORDER : CLIENT_STEP_ORDER,
  );
  const missingEvidenceSteps = uniqueSorted(
    expectedSteps.filter((step) => !coveredSteps.has(step)),
  );

  return {
    generated_at: input.generatedAt ?? new Date().toISOString(),
    round_label: input.roundLabel,
    summary: {
      counts,
      missing_evidence_steps: missingEvidenceSteps,
      top_friction_roles: topFrictionRoles,
    },
    backlog_items: backlogItems,
  };
}

export function buildPlaytestDecisionGate(report: PlaytestTriageReport): PlaytestDecisionGate {
  const blockerItems = report.backlog_items.filter((item) => item.final_category === "bloqueador");
  const mandatoryFixItems = report.backlog_items.filter(
    (item) =>
      item.final_category === "melhoria_antes_da_proxima_demo" &&
      item.affected_steps.some((step) => CRITICAL_DECISION_STEPS.includes(step)),
  );
  const criticalMissingEvidence = report.summary.missing_evidence_steps.filter((step) =>
    CRITICAL_DECISION_STEPS.includes(step),
  );
  const onlyFutureBacklog =
    report.backlog_items.length > 0 &&
    report.backlog_items.every((item) => item.final_category === "futuro_backlog");

  if (blockerItems.length > 0) {
    return {
      recommendation: "fix",
      executive_summary: `Fix recomendado: ${blockerItems.length} bloqueador(es) ainda impedem continuidade segura do ciclo.`,
      decision_factors: [
        `${blockerItems.length} item(ns) em bloqueador puxam a decisao.`,
        ...blockerItems.map(
          (item) =>
            `bloqueador em ${item.affected_steps.join(", ")} com suporte ${item.correlation_ids.join(", ") || "sem correlation_id"}.`,
        ),
      ],
      supporting_backlog_items: blockerItems,
      next_cycle_action: "corrigir bloqueadores",
    };
  }

  if (mandatoryFixItems.length > 0) {
    return {
      recommendation: "fix",
      executive_summary: `Fix recomendado: ${mandatoryFixItems.length} melhoria(s) antes da proxima demo atingem etapa critica do MVP.`,
      decision_factors: [
        `${mandatoryFixItems.length} item(ns) em melhoria_antes_da_proxima_demo exigem correcao antes da proxima demo.`,
        ...mandatoryFixItems.map(
          (item) =>
            `melhoria_antes_da_proxima_demo em ${item.affected_steps.join(", ")}: ${item.title}.`,
        ),
      ],
      supporting_backlog_items: mandatoryFixItems,
      next_cycle_action: "corrigir bloqueadores",
    };
  }

  if (criticalMissingEvidence.length > 0) {
    return {
      recommendation: "defer",
      executive_summary: `Defer recomendado: faltam evidencias criticas para sustentar expansao segura do MVP atual.`,
      decision_factors: [
        `Etapas criticas sem evidencia suficiente: ${criticalMissingEvidence.join(", ")}.`,
        `Sem bloqueador ativo, mas confianca da rodada ainda insuficiente para go.`,
      ],
      supporting_backlog_items: report.backlog_items.filter(
        (item) => item.final_category === "futuro_backlog",
      ),
      next_cycle_action: "adiar expansoes",
    };
  }

  if (onlyFutureBacklog) {
    return {
      recommendation: "defer",
      executive_summary: "Defer recomendado: nao ha bloqueador do MVP atual, apenas backlog futuro ou exploratorio.",
      decision_factors: [
        `${report.backlog_items.length} item(ns) restantes pertencem a futuro_backlog.`,
        `Rodada atual nao pede correcao obrigatoria antes de nova implementacao.`,
      ],
      supporting_backlog_items: report.backlog_items,
      next_cycle_action: "adiar expansoes",
    };
  }

  return {
    recommendation: "go",
    executive_summary: "Go recomendado: sem bloqueadores, sem melhoria obrigatoria e sem lacuna critica de evidencia no MVP atual.",
    decision_factors: [
      "Nenhum bloqueador ativo encontrado na consolidacao.",
      "Nenhuma melhoria obrigatoria antes da proxima demo em etapa critica.",
      "Sem lacuna critica de evidencia nas etapas minimas do MVP.",
    ],
    supporting_backlog_items: [],
    next_cycle_action: "seguir implementacao",
  };
}

export function validatePlaytestDecisionGateReport(
  report: PlaytestTriageReport,
): PlaytestDecisionGateValidationIssue[] {
  const issues: PlaytestDecisionGateValidationIssue[] = [];
  const normalizedRoundLabel = normalizeText(report.round_label);

  if (
    normalizedRoundLabel.includes("exemplo") ||
    normalizedRoundLabel.includes("mock") ||
    normalizedRoundLabel.includes("sample")
  ) {
    issues.push({
      code: "example_round_label",
      message: `Rodada \`${report.round_label}\` parece exemplo/mock e nao deve emitir gate oficial.`,
    });
  }

  const templateSources = uniqueSorted(
    report.backlog_items
      .flatMap((item) => item.evidence_sources)
      .filter((source) => source === "client-template" || source === "admin-template"),
  );

  if (templateSources.length > 0) {
    issues.push({
      code: "template_evidence_source",
      message: `Relatorio ainda referencia fonte de template (${templateSources.join(", ")}). Regerar consolidacao com evidencias humanas reais.`,
    });
  }

  return issues;
}

function parseCount(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) {
    return null;
  }

  const value = Number(line.slice(prefix.length).trim());
  return Number.isFinite(value) ? value : null;
}

function findStepByLabel(label: string): PlaytestEvidenceStep | null {
  const match = Object.entries(STEP_CONFIG).find(([, config]) => config.label === label.trim());
  return (match?.[0] as PlaytestEvidenceStep | undefined) ?? null;
}

function parseReportSupportRefs(raw: string): PlaytestTriageBacklogItem["support_refs"] {
  const refs = {
    batch_ids: [] as string[],
    document_ids: [] as string[],
    case_ids: [] as string[],
    user_ids: [] as string[],
  };

  for (const segment of raw.split(";")) {
    const [key, values] = segment.split("=");
    const normalizedValues = (values ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== "n/a");

    if (key?.trim() === "batch") {
      refs.batch_ids = normalizedValues;
    }
    if (key?.trim() === "document") {
      refs.document_ids = normalizedValues;
    }
    if (key?.trim() === "case") {
      refs.case_ids = normalizedValues;
    }
    if (key?.trim() === "user") {
      refs.user_ids = normalizedValues;
    }
  }

  return refs;
}

export function parsePlaytestTriageReportMarkdown(markdown: string): PlaytestTriageReport {
  const lines = markdown.split(/\r?\n/);
  const counts: Record<PlaytestTriageFinalCategory, number> = {
    bloqueador: 0,
    melhoria_antes_da_proxima_demo: 0,
    futuro_backlog: 0,
  };
  const missingEvidenceSteps: PlaytestEvidenceStep[] = [];
  const topFrictionRoles: PlaytestTriageReport["summary"]["top_friction_roles"] = [];
  const backlogItems: PlaytestTriageBacklogItem[] = [];

  let roundLabel = "rodada-playtesting";
  let generatedAt = new Date().toISOString();
  let section: "missing" | "roles" | "backlog" | null = null;
  let currentItem: Partial<PlaytestTriageBacklogItem> | null = null;

  const flushCurrentItem = () => {
    if (
      currentItem?.title &&
      currentItem.final_category &&
      currentItem.work_type &&
      currentItem.summary &&
      currentItem.impact_summary &&
      currentItem.suggested_next_action &&
      currentItem.triage_reason &&
      currentItem.source_types &&
      currentItem.evidence_sources &&
      currentItem.affected_roles &&
      currentItem.affected_steps &&
      currentItem.correlation_ids &&
      currentItem.support_refs
    ) {
      backlogItems.push(currentItem as PlaytestTriageBacklogItem);
    }
    currentItem = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    if (trimmed === "## Etapas sem evidencia suficiente") {
      flushCurrentItem();
      section = "missing";
      continue;
    }

    if (trimmed === "## Areas de maior friccao por papel") {
      flushCurrentItem();
      section = "roles";
      continue;
    }

    if (trimmed === "## Backlog Acionavel") {
      flushCurrentItem();
      section = "backlog";
      continue;
    }

    if (trimmed.startsWith("- Rodada: ")) {
      roundLabel = trimmed.slice("- Rodada: ".length).trim();
      continue;
    }

    if (trimmed.startsWith("- Gerado em: ")) {
      generatedAt = trimmed.slice("- Gerado em: ".length).trim();
      continue;
    }

    const blockerCount = parseCount(trimmed, "- Bloqueadores: ");
    if (blockerCount !== null) {
      counts.bloqueador = blockerCount;
      continue;
    }

    const improvementCount = parseCount(trimmed, "- Melhorias antes da proxima demo: ");
    if (improvementCount !== null) {
      counts.melhoria_antes_da_proxima_demo = improvementCount;
      continue;
    }

    const futureCount = parseCount(trimmed, "- Futuro backlog: ");
    if (futureCount !== null) {
      counts.futuro_backlog = futureCount;
      continue;
    }

    if (section === "missing" && trimmed.startsWith("- ")) {
      const stepMatch = trimmed.match(/\(`([^`]+)`\)$/);
      const step = stepMatch?.[1] as PlaytestEvidenceStep | undefined;
      if (step && PLAYTEST_EVIDENCE_STEPS.includes(step)) {
        missingEvidenceSteps.push(step);
      } else if (trimmed !== "- Nenhuma etapa pendente.") {
        const label = trimmed.slice(2).replace(/\s*\(`[^`]+`\)\s*$/, "");
        const resolvedStep = findStepByLabel(label);
        if (resolvedStep) {
          missingEvidenceSteps.push(resolvedStep);
        }
      }
      continue;
    }

    if (section === "roles" && trimmed.startsWith("- ")) {
      const roleMatch = trimmed.match(/^- ([^:]+): (\d+) achado\(s\)$/);
      if (roleMatch) {
        topFrictionRoles.push({
          role: roleMatch[1] as PlaytestEvidenceRole,
          total_findings: Number(roleMatch[2]),
        });
      }
      continue;
    }

    if (section === "backlog" && trimmed.startsWith("### ")) {
      flushCurrentItem();
      currentItem = {
        title: trimmed.slice(4).trim(),
        source_types: [],
        evidence_sources: [],
        affected_roles: [],
        affected_steps: [],
        correlation_ids: [],
      };
      continue;
    }

    if (!currentItem || !trimmed.startsWith("- ")) {
      continue;
    }

    const readValue = (prefix: string) => trimmed.slice(prefix.length).trim();
    if (trimmed.startsWith("- Categoria final: ")) {
      currentItem.final_category = readValue("- Categoria final: ") as PlaytestTriageFinalCategory;
      continue;
    }
    if (trimmed.startsWith("- Tipo de trabalho: ")) {
      currentItem.work_type = readValue("- Tipo de trabalho: ") as PlaytestBacklogWorkType;
      continue;
    }
    if (trimmed.startsWith("- Resumo reproduzivel: ")) {
      currentItem.summary = readValue("- Resumo reproduzivel: ");
      continue;
    }
    if (trimmed.startsWith("- Impacto no MVP: ")) {
      currentItem.impact_summary = readValue("- Impacto no MVP: ");
      continue;
    }
    if (trimmed.startsWith("- Papeis afetados: ")) {
      currentItem.affected_roles = readValue("- Papeis afetados: ")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean) as PlaytestEvidenceRole[];
      continue;
    }
    if (trimmed.startsWith("- Etapas afetadas: ")) {
      currentItem.affected_steps = readValue("- Etapas afetadas: ")
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is PlaytestEvidenceStep =>
          PLAYTEST_EVIDENCE_STEPS.includes(value as PlaytestEvidenceStep),
        );
      continue;
    }
    if (trimmed.startsWith("- Correlation IDs: ")) {
      const value = readValue("- Correlation IDs: ");
      currentItem.correlation_ids = value === "n/a" ? [] : value.split(",").map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (trimmed.startsWith("- Evidencias de apoio: ")) {
      currentItem.support_refs = parseReportSupportRefs(readValue("- Evidencias de apoio: "));
      continue;
    }
    if (trimmed.startsWith("- Origem: ")) {
      currentItem.evidence_sources = readValue("- Origem: ")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      currentItem.source_types = currentItem.evidence_sources.map((source) =>
        source.includes("template") ? "human" : "technical",
      );
      continue;
    }
    if (trimmed.startsWith("- Motivo da triagem: ")) {
      currentItem.triage_reason = readValue("- Motivo da triagem: ");
      continue;
    }
    if (trimmed.startsWith("- Proxima acao sugerida: ")) {
      currentItem.suggested_next_action = readValue("- Proxima acao sugerida: ");
      continue;
    }
  }

  flushCurrentItem();

  return {
    generated_at: generatedAt,
    round_label: roundLabel,
    summary: {
      counts,
      missing_evidence_steps: uniqueSorted(missingEvidenceSteps),
      top_friction_roles: topFrictionRoles,
    },
    backlog_items: backlogItems,
  };
}

export function formatPlaytestDecisionGateLogEntry(
  gate: PlaytestDecisionGate,
  report: PlaytestTriageReport,
  input: {
    storyId: string;
    storyKey: string;
    sourceReportPath: string;
    recordedAt: string;
  },
): string {
  const lines: string[] = [];

  lines.push(`## Story ${input.storyId} - ${input.storyKey}`);
  lines.push(`**Data:** ${input.recordedAt}`);
  lines.push(`**Recomendacao:** ${gate.recommendation}`);
  lines.push(`**Origem:** ${input.sourceReportPath}`);
  lines.push(`**Proximo ciclo:** ${gate.next_cycle_action}`);
  lines.push("");
  lines.push("### Contexto da Rodada");
  lines.push(`- Bloqueadores: ${report.summary.counts.bloqueador}`);
  lines.push(
    `- Melhorias antes da proxima demo: ${report.summary.counts.melhoria_antes_da_proxima_demo}`,
  );
  lines.push(`- Futuro backlog: ${report.summary.counts.futuro_backlog}`);
  if (report.summary.missing_evidence_steps.length === 0) {
    lines.push("- Etapas sem evidencia suficiente: nenhuma");
  } else {
    lines.push(
      `- Etapas sem evidencia suficiente: ${report.summary.missing_evidence_steps.join(", ")}`,
    );
  }
  if (report.summary.top_friction_roles.length === 0) {
    lines.push("- Areas/papeis com maior friccao: nenhum achado priorizado");
  } else {
    lines.push(
      `- Areas/papeis com maior friccao: ${report.summary.top_friction_roles
        .map((roleInfo) => `${roleInfo.role} (${roleInfo.total_findings})`)
        .join(", ")}`,
    );
  }
  lines.push("");
  lines.push("### Resumo Executivo");
  lines.push(gate.executive_summary);
  lines.push("");
  lines.push("### Evidencias-chave");
  for (const factor of gate.decision_factors) {
    lines.push(`- ${factor}`);
  }
  lines.push("");
  lines.push("### Backlog determinante");
  if (gate.supporting_backlog_items.length === 0) {
    lines.push("- Nenhum item determinante adicional.");
  } else {
    for (const item of gate.supporting_backlog_items) {
      lines.push(
        `- ${item.title} [${item.final_category}] (${item.correlation_ids.join(", ") || "sem correlation_id"})`,
      );
    }
  }
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

export function upsertDecisionGateLogEntry(
  logContent: string,
  logEntry: string,
  input: {
    storyId: string;
    storyKey: string;
  },
): string {
  const heading = `## Story ${input.storyId} - ${input.storyKey}`;
  const trimmedEntry = logEntry.trim();
  const startIndex = logContent.indexOf(heading);

  if (startIndex >= 0) {
    const nextSectionIndex = logContent.indexOf("\n## ", startIndex + heading.length);
    const before = logContent.slice(0, startIndex).trimEnd();
    const after =
      nextSectionIndex >= 0 ? logContent.slice(nextSectionIndex).trimStart() : "";

    if (after.length > 0) {
      return `${before}\n\n${trimmedEntry}\n\n${after.trimEnd()}\n`;
    }

    return `${before}\n\n${trimmedEntry}\n`;
  }

  const base = logContent.trimEnd();
  return `${base}\n\n${trimmedEntry}\n`;
}

export function upsertDecisionGateInSprintStatus(
  sprintStatusContent: string,
  gate: PlaytestDecisionGate,
  input: {
    sourceStory: string;
    sourceReport: string;
    recordedAt: string;
  },
): string {
  const lines = sprintStatusContent.split(/\r?\n/);
  const kept: string[] = [];
  let skippingDecisionGate = false;

  for (const line of lines) {
    if (!skippingDecisionGate && line.startsWith("decision_gate:")) {
      skippingDecisionGate = true;
      continue;
    }

    if (skippingDecisionGate) {
      if (line.startsWith("  ") || line.trim().length === 0) {
        continue;
      }
      skippingDecisionGate = false;
    }

    kept.push(line);
  }

  while (kept.length > 0 && kept[kept.length - 1] === "") {
    kept.pop();
  }

  kept.push("");
  kept.push("decision_gate:");
  kept.push(`  recommendation: ${gate.recommendation}`);
  kept.push(`  source_story: ${input.sourceStory}`);
  kept.push(`  source_report: ${input.sourceReport}`);
  kept.push(`  next_cycle_action: ${gate.next_cycle_action}`);
  kept.push(`  recorded_at: ${input.recordedAt}`);

  return `${kept.join("\n")}\n`;
}

export function formatPlaytestTriageReportAsMarkdown(report: PlaytestTriageReport): string {
  const lines: string[] = [];

  lines.push("# Consolidacao Final de Playtesting");
  lines.push("");
  lines.push(`- Rodada: ${report.round_label}`);
  lines.push(`- Gerado em: ${report.generated_at}`);
  lines.push(`- Bloqueadores: ${report.summary.counts.bloqueador}`);
  lines.push(`- Melhorias antes da proxima demo: ${report.summary.counts.melhoria_antes_da_proxima_demo}`);
  lines.push(`- Futuro backlog: ${report.summary.counts.futuro_backlog}`);
  lines.push("");

  lines.push("## Etapas sem evidencia suficiente");
  lines.push("");
  if (report.summary.missing_evidence_steps.length === 0) {
    lines.push("- Nenhuma etapa pendente.");
  } else {
    for (const step of report.summary.missing_evidence_steps) {
      lines.push(`- ${STEP_CONFIG[step].label} (\`${step}\`)`);
    }
  }
  lines.push("");

  lines.push("## Areas de maior friccao por papel");
  lines.push("");
  if (report.summary.top_friction_roles.length === 0) {
    lines.push("- Nenhum achado priorizado.");
  } else {
    for (const roleInfo of report.summary.top_friction_roles) {
      lines.push(`- ${roleInfo.role}: ${roleInfo.total_findings} achado(s)`);
    }
  }
  lines.push("");

  lines.push("## Backlog Acionavel");
  lines.push("");
  for (const item of report.backlog_items) {
    lines.push(`### ${item.title}`);
    lines.push("");
    lines.push(`- Categoria final: ${item.final_category}`);
    lines.push(`- Tipo de trabalho: ${item.work_type}`);
    lines.push(`- Resumo reproduzivel: ${item.summary}`);
    lines.push(`- Impacto no MVP: ${item.impact_summary}`);
    lines.push(`- Papeis afetados: ${item.affected_roles.join(", ")}`);
    lines.push(`- Etapas afetadas: ${item.affected_steps.join(", ")}`);
    lines.push(`- Correlation IDs: ${item.correlation_ids.join(", ") || "n/a"}`);
    lines.push(
      `- Evidencias de apoio: batch=${item.support_refs.batch_ids.join(", ") || "n/a"}; document=${item.support_refs.document_ids.join(", ") || "n/a"}; case=${item.support_refs.case_ids.join(", ") || "n/a"}; user=${item.support_refs.user_ids.join(", ") || "n/a"}`,
    );
    lines.push(`- Origem: ${item.evidence_sources.join(", ")}`);
    lines.push(`- Motivo da triagem: ${item.triage_reason}`);
    lines.push(`- Proxima acao sugerida: ${item.suggested_next_action}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}
