import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { isTimestampWithinSkew, isValidHmacSignature, signHmacSha256Hex } from "@/lib/security/hmac-signature";
import { listExternalIngestions, ExternalIngestionError } from "@/modules/integrations/application/list-external-ingestions";
import { registerExternalIngestion } from "@/modules/integrations/application/register-external-ingestion";
import {
  AUTHORIZED_EXTERNAL_SOURCES,
  type AuthorizedExternalSource,
  validateExternalIngestionContract,
} from "@/modules/integrations/domain/external-ingestion";

const intakeSchema = z.object({
  tenant_id: z.string().uuid(),
  contract_version: z.string().trim().min(1).max(32),
  source_reference: z.string().trim().min(3).max(255),
  idempotency_key: z.string().trim().min(8).max(128),
  payload_summary: z.record(z.string(), z.unknown()).optional(),
});

const MAX_INTEGRATION_SIGNATURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

const querySchema = z
  .object({
    ingestion_id: z.string().trim().min(1).optional(),
    status: z.enum(["received", "processing", "processed", "failed"]).optional(),
    source_system: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.source_system && !AUTHORIZED_EXTERNAL_SOURCES.includes(value.source_system as (typeof AUTHORIZED_EXTERNAL_SOURCES)[number])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origem externa nao autorizada.",
        path: ["source_system"],
      });
    }
  });

function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  init?: ResponseInit,
) {
  return withCorrelationHeader(NextResponse.json(body, init), correlationId);
}

function getIntegrationSecret(sourceSystem: AuthorizedExternalSource): string {
  const secretEnvKeyBySource: Record<AuthorizedExternalSource, string> = {
    "payroll-api": "PAYROLL_API_EXTERNAL_INGESTION_SECRET",
    "sftp-gateway": "SFTP_GATEWAY_EXTERNAL_INGESTION_SECRET",
  };

  const secret = process.env[secretEnvKeyBySource[sourceSystem]];
  if (!secret) {
    throw new Error("EXTERNAL_INGESTION_SECRET_MISSING");
  }

  return secret;
}

function buildSignedWebhookPayload(params: {
  method: string;
  path: string;
  timestamp: string;
  body: string;
}) {
  return [params.method, params.path, params.timestamp, params.body].join("\n");
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const sourceSystem = request.headers.get("x-integration-source") ?? undefined;
  const timestamp = request.headers.get("x-integration-timestamp") ?? undefined;
  const signature = request.headers.get("x-integration-signature") ?? undefined;
  const rawBody = await request.text().catch(() => null);

  if (!sourceSystem || !AUTHORIZED_EXTERNAL_SOURCES.includes(sourceSystem as (typeof AUTHORIZED_EXTERNAL_SOURCES)[number])) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Origem externa nao autorizada.", correlationId, {
        source_system: sourceSystem ?? null,
      }),
      correlationId,
      { status: 403 },
    );
  }

  if (!timestamp || !signature || !rawBody) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Assinatura de integracao ausente ou invalida.", correlationId, {
        source_system: sourceSystem,
      }),
      correlationId,
      { status: 403 },
    );
  }

  if (!isTimestampWithinSkew(timestamp, MAX_INTEGRATION_SIGNATURE_CLOCK_SKEW_MS)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Timestamp de integracao expirado ou invalido.", correlationId, {
        source_system: sourceSystem,
      }),
      correlationId,
      { status: 403 },
    );
  }

  let parsedBodyValue: unknown;

  try {
    parsedBodyValue = JSON.parse(rawBody);
  } catch {
    parsedBodyValue = null;
  }

  let secret: string;
  try {
    secret = getIntegrationSecret(sourceSystem as AuthorizedExternalSource);
  } catch {
    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Segredo de integracao ausente.", correlationId),
      correlationId,
      { status: 500 },
    );
  }

  const expectedSignature = signHmacSha256Hex(
    secret,
    buildSignedWebhookPayload({
      method: request.method,
      path: request.nextUrl.pathname,
      timestamp,
      body: rawBody,
    }),
  );

  if (!isValidHmacSignature(expectedSignature, signature)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Assinatura de integracao invalida.", correlationId, {
        source_system: sourceSystem,
      }),
      correlationId,
      { status: 403 },
    );
  }

  const parsedBody = intakeSchema.safeParse(parsedBodyValue);

  if (!parsedBody.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de intake externo invalido.", correlationId, {
        issues: parsedBody.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const contractValidation = validateExternalIngestionContract({
    sourceSystem: sourceSystem as AuthorizedExternalSource,
    contractVersion: parsedBody.data.contract_version,
    payloadSummary: parsedBody.data.payload_summary ?? {},
  });

  if (!contractValidation.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Contrato externo invalido para a origem informada.", correlationId, {
        source_system: sourceSystem,
        contract_version: contractValidation.contract_version,
        validation_result: contractValidation.validation_result,
        failure_code: contractValidation.failure_code,
        ...contractValidation.details,
      }),
      correlationId,
      { status: 400 },
    );
  }

  try {
    const record = await registerExternalIngestion({
      tenantId: parsedBody.data.tenant_id,
      sourceSystem,
      contractVersion: parsedBody.data.contract_version,
      sourceReference: parsedBody.data.source_reference,
      idempotencyKey: parsedBody.data.idempotency_key,
      payloadSummary: parsedBody.data.payload_summary,
      correlationId,
    });

    return jsonResponse(successResponse(record, correlationId, record.tenant_id), correlationId, { status: 202 });
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("PROCESSING_FAILURE", "Falha ao registrar intake externo.", correlationId, {
        failure_code: "PROCESSING_FAILURE",
        recommended_action: "Revise os logs tecnicos e tente novamente.",
      }),
      correlationId,
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsedQuery.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Filtros de integracao invalidos.", correlationId, {
        issues: parsedQuery.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, {
      status: 401,
    });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });
  } catch (error) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      { status: 403 },
    );
  }

  const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para consultar integracoes externas.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await listExternalIngestions({
      tenantId: session.tenantId,
      status: parsedQuery.data.status,
      sourceSystem: parsedQuery.data.source_system,
      ingestionId: parsedQuery.data.ingestion_id,
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar integracoes externas.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
