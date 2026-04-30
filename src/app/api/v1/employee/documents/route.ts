import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  assertTenantAction,
  RBAC_ACTIONS,
  type RbacRole,
} from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listEmployeeDocuments } from "@/lib/documents/list-documents";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";

const querySchema = z.object({
  tenant_id: z.string().uuid(),
  period_ref: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  document_type: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
});

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const queryParsed = querySchema.safeParse({
    tenant_id: request.nextUrl.searchParams.get("tenant_id"),
    period_ref: request.nextUrl.searchParams.get("period_ref") ?? undefined,
    document_type: request.nextUrl.searchParams.get("document_type") ?? undefined,
  });

  if (!queryParsed.success) {
    await writePlaytestEvent({
      tenantId: request.nextUrl.searchParams.get("tenant_id") ?? "anonymous",
      correlationId,
      action: "playtest.employee.docs.friction",
      resourceType: "employee_documents",
      status: "failure",
      details: { cause: "validation_error", issues: queryParsed.error.issues },
    });
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Filtros de consulta invalidos.",
        correlationId,
        { issues: queryParsed.error.issues },
        undefined,
        { response_time_ms: Math.round(performance.now() - startTime) }
      ),
      { status: 400 },
    );
  }

  const { tenant_id: tenantId, period_ref: periodRef, document_type: documentType } =
    queryParsed.data;

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    await writePlaytestEvent({ tenantId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "unauthorized", reason: "Sessao ausente" } });
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId, undefined, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await writePlaytestEvent({ tenantId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "unauthorized", reason: "Sessao invalida ou expirada" } });
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId, undefined, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 401 },
    );
  }

  if (session.tenantId !== tenantId) {
    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "forbidden", reason: "Tenant fora do escopo" } });
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId, undefined, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 403 },
    );
  }

  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, session.userId),
        eq(userTenantMappings.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const role = mappings[0]?.role as RbacRole | undefined;
  if (!role) {
    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "forbidden", reason: "Usuario sem permissao no tenant" } });
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId, undefined, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });
  } catch (error) {
    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "forbidden", reason: "Acesso negado pelo RBAC" } });
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 403 },
    );
  }

  if (role !== "colaborador") {
    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "forbidden", reason: "Nao e colaborador" } });
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente colaborador pode acessar a lista de documentos pessoais.",
        correlationId,
        undefined,
        undefined,
        { response_time_ms: Math.round(performance.now() - startTime) }
      ),
      { status: 403 },
    );
  }

  try {
    const items = await listEmployeeDocuments({
      tenantId,
      userId: session.userId,
      periodRef,
      documentType,
    });

    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.view", resourceType: "employee_documents", status: "success", details: { items_count: items.length } });

    return NextResponse.json(
      successResponse(
        {
          items,
          filters: {
            tenant_id: tenantId,
            period_ref: periodRef ?? null,
            document_type: documentType ?? null,
          },
        },
        correlationId,
        tenantId,
        { response_time_ms: Math.round(performance.now() - startTime) }
      ),
    );
  } catch (error) {
    await writePlaytestEvent({ tenantId, actorId: session.userId, correlationId, action: "playtest.employee.docs.friction", resourceType: "employee_documents", status: "failure", details: { cause: "internal_error", error: (error as Error).message } });
    return NextResponse.json(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao listar documentos.", correlationId, undefined, undefined, { response_time_ms: Math.round(performance.now() - startTime) }),
      { status: 500 },
    );
  }
}