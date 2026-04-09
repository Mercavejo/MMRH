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
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      { status: 401 },
    );
  }

  const queryParsed = querySchema.safeParse({
    tenant_id: request.nextUrl.searchParams.get("tenant_id"),
    period_ref: request.nextUrl.searchParams.get("period_ref") ?? undefined,
    document_type: request.nextUrl.searchParams.get("document_type") ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Filtros de consulta invalidos.",
        correlationId,
        { issues: queryParsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const { tenant_id: tenantId, period_ref: periodRef, document_type: documentType } =
    queryParsed.data;

  if (session.tenantId !== tenantId) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
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
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
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
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      { status: 403 },
    );
  }

  if (role !== "colaborador") {
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente colaborador pode acessar a lista de documentos pessoais.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  const items = await listEmployeeDocuments({
    tenantId,
    userId: session.userId,
    periodRef,
    documentType,
  });

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
    ),
  );
}