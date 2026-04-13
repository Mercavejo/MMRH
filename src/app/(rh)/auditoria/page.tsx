import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listAuditEvents, AuditEventsError } from "@/modules/audit/application/list-audit-events";
import { StatusTimeline } from "@/components/audit/status-timeline";
import type { AuditEventRecord, AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";
import { SupportCasePanel } from "@/components/support/support-case-panel";
import { getSupportCase, SupportCaseError } from "@/modules/support/application/get-support-case";
import type { SupportCase } from "@/modules/support/domain/support-case";

type RhAuditSearchParams = {
  from?: string;
  to?: string;
  batch_id?: string;
  document_id?: string;
  user_id?: string;
  case_id?: string;
  page?: string;
  page_size?: string;
};

type AuditPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type RhAuditFilters = {
  from: string;
  to: string;
  batch_id: string;
  document_id: string;
  user_id: string;
  case_id: string;
  page: number;
  page_size: number;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function buildAuditFilters(searchParams?: RhAuditSearchParams): RhAuditFilters {
  return {
    from: searchParams?.from ?? "",
    to: searchParams?.to ?? "",
    batch_id: searchParams?.batch_id ?? "",
    document_id: searchParams?.document_id ?? "",
    user_id: searchParams?.user_id ?? "",
    case_id: searchParams?.case_id ?? "",
    page: parsePositiveInteger(searchParams?.page, 1),
    page_size: parsePositiveInteger(searchParams?.page_size, 20),
  };
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function loadAuditData(filters: RhAuditFilters) {
  const sessionToken = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return {
      events: [] as AuditEventRecord[],
      timeline: [] as AuditTimelineEntry[],
      pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
      supportCase: null as SupportCase | null,
      supportCaseError: null as string | null,
      errorMessage: "Sessao ausente.",
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      events: [] as AuditEventRecord[],
      timeline: [] as AuditTimelineEntry[],
      pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
      supportCase: null as SupportCase | null,
      supportCaseError: null as string | null,
      errorMessage: "Sessao invalida ou expirada.",
    };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return {
      events: [] as AuditEventRecord[],
      timeline: [] as AuditTimelineEntry[],
      pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
      supportCase: null as SupportCase | null,
      supportCaseError: null as string | null,
      errorMessage: "Usuario sem permissao no tenant.",
    };
  }

  const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "suporte", "admin_plataforma"];

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });

    if (!allowedRoles.includes(role)) {
      return {
        events: [] as AuditEventRecord[],
        timeline: [] as AuditTimelineEntry[],
        pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
        supportCase: null as SupportCase | null,
        supportCaseError: null as string | null,
        errorMessage: "Perfil sem permissao para consultar auditoria.",
      };
    }

    const data = await listAuditEvents({
      tenantId: session.tenantId,
      from: filters.from || undefined,
      to: filters.to || undefined,
      batchId: filters.batch_id || undefined,
      documentId: filters.document_id || undefined,
      userId: filters.user_id || undefined,
      page: filters.page,
      pageSize: filters.page_size,
    });

    let supportCase: SupportCase | null = null;
    let supportCaseError: string | null = null;

    if (filters.case_id.trim()) {
      const caseViewRoles: RbacRole[] = ["rh_gestor", "suporte", "admin_plataforma"];
      if (!caseViewRoles.includes(role)) {
        supportCaseError = "Perfil sem permissao para consultar consolidacao de caso de suporte.";
      } else {
      try {
        supportCase = await getSupportCase({
          tenantId: session.tenantId,
          caseId: filters.case_id.trim(),
          from: filters.from || undefined,
          to: filters.to || undefined,
          batchId: filters.batch_id || undefined,
          documentId: filters.document_id || undefined,
          userId: filters.user_id || undefined,
        });
      } catch (error) {
        if (error instanceof SupportCaseError) {
          supportCaseError = error.message;
        } else {
          supportCaseError = "Falha ao carregar consolidacao de caso de suporte.";
        }
      }
      }
    }

    return {
      events: data.events,
      timeline: data.timeline,
      pagination: data.pagination,
      supportCase,
      supportCaseError,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof AuditEventsError) {
      return {
        events: [] as AuditEventRecord[],
        timeline: [] as AuditTimelineEntry[],
        pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
        supportCase: null as SupportCase | null,
        supportCaseError: null as string | null,
        errorMessage: error.message,
      };
    }

    return {
      events: [] as AuditEventRecord[],
      timeline: [] as AuditTimelineEntry[],
      pagination: { page: 1, page_size: filters.page_size, total: 0, total_pages: 1 } as AuditPagination,
      supportCase: null as SupportCase | null,
      supportCaseError: null as string | null,
      errorMessage: "Falha ao carregar trilha de auditoria.",
    };
  }
}

export function RhAuditPageView(props: {
  filters: RhAuditFilters;
  events: AuditEventRecord[];
  timeline: AuditTimelineEntry[];
  pagination: AuditPagination;
  supportCase: SupportCase | null;
  supportCaseError?: string | null;
  errorMessage?: string | null;
}) {
  const { filters, events, timeline, pagination, supportCase, supportCaseError, errorMessage } = props;

  return (
    <main>
      <h1>Trilha de auditoria</h1>

      <section aria-label="Filtrar eventos">
        <h2>Filtrar eventos</h2>
        <form method="get">
          <label>
            De
            <input type="datetime-local" name="from" defaultValue={filters.from} />
          </label>
          <label>
            Ate
            <input type="datetime-local" name="to" defaultValue={filters.to} />
          </label>
          <label>
            Lote
            <input type="text" name="batch_id" defaultValue={filters.batch_id} />
          </label>
          <label>
            Documento
            <input type="text" name="document_id" defaultValue={filters.document_id} />
          </label>
          <label>
            Usuario
            <input type="text" name="user_id" defaultValue={filters.user_id} />
          </label>
          <label>
            Case ID
            <input type="text" name="case_id" defaultValue={filters.case_id} />
          </label>
          <label>
            Pagina
            <input type="number" min={1} name="page" defaultValue={filters.page} />
          </label>
          <label>
            Itens por pagina
            <input type="number" min={1} max={100} name="page_size" defaultValue={filters.page_size} />
          </label>
          <button type="submit">Aplicar filtros</button>
        </form>
      </section>

      {errorMessage ? <p role="status">{errorMessage}</p> : null}

      <section aria-label="Lista de eventos">
        <h2>Eventos</h2>
        {events.length === 0 ? (
          <p>Nenhum evento encontrado para os filtros atuais.</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.action}</strong>
                <div>Status: {event.status}</div>
                <div>Recurso: {event.resource_type}</div>
                <div>Recurso ID: {event.resource_id}</div>
                <div>Correlation ID: {event.correlation_id}</div>
                <div>Ator: {event.actor_id ?? "sistema"}</div>
                <div>Data: {event.created_at}</div>
              </li>
            ))}
          </ul>
        )}
        <p>
          Pagina {pagination.page} de {pagination.total_pages} - Total de eventos: {pagination.total}
        </p>
      </section>

      <StatusTimeline items={timeline} />

      <SupportCasePanel supportCase={supportCase} errorMessage={supportCaseError} isLoading={false} />
    </main>
  );
}

export default async function RhAuditoriaPage({ searchParams }: { searchParams?: RhAuditSearchParams }) {
  const filters = buildAuditFilters(searchParams);
  const data = await loadAuditData(filters);

  return (
    <RhAuditPageView
      filters={filters}
      events={data.events}
      timeline={data.timeline}
      pagination={data.pagination}
      supportCase={data.supportCase}
      supportCaseError={data.supportCaseError}
      errorMessage={data.errorMessage}
    />
  );
}
