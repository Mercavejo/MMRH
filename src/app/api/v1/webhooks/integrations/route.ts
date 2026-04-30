import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { buildCapabilityForbiddenDetails, ErrorCode } from "@/lib/api/errors";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { isTimestampWithinSkew, isValidHmacSignature, signHmacSha256Hex } from "@/lib/security/hmac-signature";
import { listExternalIngestions, ExternalIngestionError } from "@/modules/integrations/application/list-external-ingestions";
import { registerExternalIngestion } from "@/modules/integrations/application/register-external-ingestion";
import { resolveExternalIdentifierMappingForIntake } from "@/modules/integrations/application/resolve-external-identifier-mapping";
import { upsertExternalIdentifierMappingRule } from "@/modules/integrations/application/upsert-external-identifier-mapping";
import {
  AUTHORIZED_EXTERNAL_SOURCES,
  type AuthorizedExternalSource,
  validateExternalIngestionContract,
} from "@/modules/integrations/domain/external-ingestion";
import { enforceCapability } from "@/modules/plans/application/enforce-capability";
import { CapabilityForbiddenError, Capability } from "@/modules/plans/domain/capabilities";

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

const putMappingSchema = z
  .object({
    tenant_id: z.string().uuid(),
    source_system: z.string().trim().min(1),
    external_identifier: z.string().trim().min(1).max(255),
    employee_id: z.string().uuid().nullable().optional(),
    disable: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (!AUTHORIZED_EXTERNAL_SOURCES.includes(value.source_system as (typeof AUTHORIZED_EXTERNAL_SOURCES)[number])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origem externa nao autorizada.",
        path: ["source_system"],
      });
    }

    if (!value.disable && !value.employee_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "employee_id e obrigatorio quando disable=false.",
        path: ["employee_id"],
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

async function hasTenantMembership(userId: string, tenantId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: userTenantMappings.userId })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return Boolean(rows[0]);
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
    await enforceCapability(parsedBody.data.tenant_id, Capability.EXTERNAL_INTEGRATIONS, null, correlationId);
  } catch (capabilityError) {
    if (capabilityError instanceof CapabilityForbiddenError) {
      return jsonResponse(
        errorResponse(
          ErrorCode.CapabilityForbidden,
          "Esta funcionalidade nao esta disponivel no plano atual.",
          correlationId,
          buildCapabilityForbiddenDetails({
            capability: capabilityError.capability,
            planCode: capabilityError.planCode,
            correlationId,
            upgradeHint: capabilityError.upgradeHint,
          }),
        ),
        correlationId,
        { status: 403 },
      );
    }
    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao validar capacidade do plano atual.", correlationId),
      correlationId,
      { status: 500 },
    );
  }

  try {
    const mapping = await resolveExternalIdentifierMappingForIntake({
      tenantId: parsedBody.data.tenant_id,
      sourceSystem,
      payloadSummary: parsedBody.data.payload_summary ?? {},
    });

    if (mapping.status !== "mapped") {
      const mappingFailureCode = mapping.failure_code ?? "MAPPING_NOT_FOUND";
      const mappingStatusCode = mappingFailureCode === "AMBIGUOUS_ASSOCIATION" ? 409 : 422;
      const mappingMessage =
        mappingFailureCode === "AMBIGUOUS_ASSOCIATION"
          ? "Nao foi possivel resolver identificador externo para colaborador unico."
          : "Nao foi possivel localizar mapeamento ativo para o identificador externo informado.";

      await registerExternalIngestion({
        tenantId: parsedBody.data.tenant_id,
        sourceSystem,
        contractVersion: parsedBody.data.contract_version,
        sourceReference: parsedBody.data.source_reference,
        idempotencyKey: parsedBody.data.idempotency_key,
        payloadSummary: parsedBody.data.payload_summary,
        externalIdentifier: mapping.external_identifier,
        mappedEmployeeId: undefined,
        mappingVersion: undefined,
        mappingStatus: mapping.status,
        failureCode: mappingFailureCode,
        recommendedAction: mapping.recommended_action,
        status: "failed",
        correlationId,
      });

      return jsonResponse(
        errorResponse(mappingFailureCode, mappingMessage, correlationId, {
          source_system: sourceSystem,
          tenant_id: parsedBody.data.tenant_id,
          external_identifier: mapping.external_identifier,
          failure_code: mapping.failure_code,
          recommended_action: mapping.recommended_action,
        }),
        correlationId,
        { status: mappingStatusCode },
      );
    }

    const record = await registerExternalIngestion({
      tenantId: parsedBody.data.tenant_id,
      sourceSystem,
      contractVersion: parsedBody.data.contract_version,
      sourceReference: parsedBody.data.source_reference,
      idempotencyKey: parsedBody.data.idempotency_key,
      payloadSummary: parsedBody.data.payload_summary,
      externalIdentifier: mapping.external_identifier,
      mappedEmployeeId: mapping.mapped_employee_id ?? undefined,
      mappingVersion: mapping.mapping_version ?? undefined,
      mappingStatus: mapping.status,
      failureCode: null,
      recommendedAction: null,
      status: "received",
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

export async function PUT(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
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

  let parsedBodyValue: unknown;
  try {
    parsedBodyValue = await request.json();
  } catch {
    parsedBodyValue = null;
  }

  const parsedBody = putMappingSchema.safeParse(parsedBodyValue);
  if (!parsedBody.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de mapeamento invalido.", correlationId, {
        issues: parsedBody.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  if (parsedBody.data.tenant_id !== session.tenantId) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso cross-tenant nao permitido.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const allowedRoles: RbacRole[] = ["admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para alterar mapeamentos.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: parsedBody.data.tenant_id,
      action: RBAC_ACTIONS.tenantWrite,
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

  if (!parsedBody.data.disable && parsedBody.data.employee_id) {
    const employeeInTenant = await hasTenantMembership(parsedBody.data.employee_id, session.tenantId);
    if (!employeeInTenant) {
      return jsonResponse(
        errorResponse("FORBIDDEN", "employee_id nao pertence ao tenant da sessao.", correlationId),
        correlationId,
        { status: 403 },
      );
    }
  }

  try {
    const result = await upsertExternalIdentifierMappingRule({
      tenantId: parsedBody.data.tenant_id,
      sourceSystem: parsedBody.data.source_system,
      externalIdentifier: parsedBody.data.external_identifier,
      employeeId: parsedBody.data.employee_id ?? null,
      disable: Boolean(parsedBody.data.disable),
      actorId: session.userId,
      correlationId,
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao atualizar mapeamento externo.", correlationId),
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
