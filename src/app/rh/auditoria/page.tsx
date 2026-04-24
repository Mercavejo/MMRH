import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listAuditEvents, AuditEventsError } from "@/modules/audit/application/list-audit-events";
import { 
  RhAuditPageView, 
  type RhAuditFilters, 
  type AuditPagination 
} from "./RhAuditPageView";
import type { AuditEventRecord, AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";
import { getSupportCase, SupportCaseError } from "@/modules/support/application/get-support-case";
import type { SupportCase } from "@/modules/support/domain/support-case";

type RhAuditSearchParams = {
  from?: string | string[];
  to?: string | string[];
  batch_id?: string | string[];
  document_id?: string | string[];
  user_id?: string | string[];
  case_id?: string | string[];
  page?: string | string[];
  page_size?: string | string[];
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? `${fallback}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getSingleString(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || "";
  return val || "";
}

export function buildAuditFilters(searchParams?: RhAuditSearchParams): RhAuditFilters {
  return {
    from: getSingleString(searchParams?.from),
    to: getSingleString(searchParams?.to),
    batch_id: getSingleString(searchParams?.batch_id),
    document_id: getSingleString(searchParams?.document_id),
    user_id: getSingleString(searchParams?.user_id),
    case_id: getSingleString(searchParams?.case_id),
    page: parsePositiveInteger(getSingleString(searchParams?.page), 1),
    page_size: Math.min(parsePositiveInteger(getSingleString(searchParams?.page_size), 20), 100),
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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
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

  const allowedRoles: RbacRole[] = ["suporte", "admin_plataforma"];

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
      const caseViewRoles: RbacRole[] = ["suporte", "admin_plataforma"];
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

export default async function RhAuditoriaPage({
  searchParams,
}: {
  searchParams?: Promise<RhAuditSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters = buildAuditFilters(resolvedSearchParams);
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

