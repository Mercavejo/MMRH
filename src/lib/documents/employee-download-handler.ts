import { createHmac, timingSafeEqual } from "node:crypto";
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
import {
  DownloadEligibilityError,
  getDownloadableDocument,
} from "@/lib/documents/get-downloadable-document";
import {
  DocumentStorageError,
  readDocumentArtifact,
} from "@/lib/documents/storage";
import { writeDocumentDownloadAudit } from "@/lib/documents/download-audit";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

type HandlerDependencies = {
  validateSessionFn?: typeof validateSession;
  getDownloadableDocumentFn?: typeof getDownloadableDocument;
  readDocumentArtifactFn?: typeof readDocumentArtifact;
  assertTenantActionFn?: typeof assertTenantAction;
  resolveCorrelationIdFn?: typeof resolveCorrelationId;
  resolveRoleFn?: (params: {
    userId: string;
    tenantId: string;
  }) => Promise<RbacRole | undefined>;
  writeDocumentDownloadAuditFn?: typeof writeDocumentDownloadAudit;
};

const querySchema = z.object({
  disposition: z.enum(["attachment", "inline"]).optional(),
  exp: z.coerce.number().int().positive().optional(),
  sig: z.string().trim().min(1).optional(),
  response: z.enum(["json", "download"]).optional(),
});

const paramsSchema = z.object({
  documentId: z.string().uuid(),
});

function buildDownloadSignature(params: {
  secret: string;
  tenantId: string;
  userId: string;
  documentId: string;
  disposition: "attachment" | "inline";
  exp: number;
}): string {
  const payload = [
    params.tenantId,
    params.userId,
    params.documentId,
    params.disposition,
    String(params.exp),
  ].join(".");

  return createHmac("sha256", params.secret)
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

function getDownloadSigningSecret(): string {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV !== "production") {
      return "demo-download-signing-secret-adalto-2026";
    }
    throw new Error("DOWNLOAD_SIGNING_SECRET_MISSING");
  }

  return secret;
}

function isValidSignature(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function handleEmployeeDocumentDownload(
  request: NextRequest,
  paramsInput: { documentId: string },
  deps: HandlerDependencies = {},
) {
  const resolveCorrelationIdFn = deps.resolveCorrelationIdFn ?? resolveCorrelationId;
  const validateSessionFn = deps.validateSessionFn ?? validateSession;
  const getDownloadableDocumentFn =
    deps.getDownloadableDocumentFn ?? getDownloadableDocument;
  const readDocumentArtifactFn =
    deps.readDocumentArtifactFn ?? readDocumentArtifact;
  const assertTenantActionFn = deps.assertTenantActionFn ?? assertTenantAction;
  const writeDocumentDownloadAuditFn =
    deps.writeDocumentDownloadAuditFn ?? writeDocumentDownloadAudit;

  const resolveRole =
    deps.resolveRoleFn ??
    (async ({ userId, tenantId }: { userId: string; tenantId: string }) => {
      const mappings = await db
        .select({ role: userTenantMappings.role })
        .from(userTenantMappings)
        .where(
          and(
            eq(userTenantMappings.userId, userId),
            eq(userTenantMappings.tenantId, tenantId),
          ),
        )
        .limit(1);

      return mappings[0]?.role as RbacRole | undefined;
    });

  const correlationId = resolveCorrelationIdFn(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const paramsParsed = paramsSchema.safeParse(paramsInput);

  if (!paramsParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Identificador de documento invalido.",
        correlationId,
        { issues: paramsParsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const queryParsed = querySchema.safeParse({
    disposition: request.nextUrl.searchParams.get("disposition") ?? undefined,
    exp: request.nextUrl.searchParams.get("exp") ?? undefined,
    sig: request.nextUrl.searchParams.get("sig") ?? undefined,
    response: request.nextUrl.searchParams.get("response") ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Parametros de download invalidos.",
        correlationId,
        { issues: queryParsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const session = await validateSessionFn(sessionToken);
  if (!session) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      { status: 401 },
    );
  }

  const tenantId = session.tenantId;
  const disposition = queryParsed.data.disposition ?? "attachment";
  const responseMode = queryParsed.data.response ?? "download";

  const role = await resolveRole({
    userId: session.userId,
    tenantId: session.tenantId,
  });
  if (!role) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantActionFn({
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
        "Somente colaborador pode baixar documentos pessoais.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  try {
    const document = await getDownloadableDocumentFn({
      documentId: paramsParsed.data.documentId,
      tenantId,
      userId: session.userId,
    });

    if ((queryParsed.data.exp && !queryParsed.data.sig) || (!queryParsed.data.exp && queryParsed.data.sig)) {
      return NextResponse.json(
        errorResponse(
          "VALIDATION_ERROR",
          "Parametros de assinatura incompletos para download.",
          correlationId,
        ),
        { status: 400 },
      );
    }

    if (queryParsed.data.exp && queryParsed.data.sig) {
      const now = Math.floor(Date.now() / 1000);
      if (queryParsed.data.exp < now) {
        return NextResponse.json(
          errorResponse(
            "DOWNLOAD_LINK_EXPIRED",
            "Link de download expirado. Solicite um novo download.",
            correlationId,
          ),
          { status: 401 },
        );
      }

      let secret: string;
      try {
        secret = getDownloadSigningSecret();
      } catch {
        return NextResponse.json(
          errorResponse(
            "DOWNLOAD_CONFIGURATION_ERROR",
            "Download temporariamente indisponivel por configuracao.",
            correlationId,
          ),
          { status: 503 },
        );
      }

      const expectedSig = buildDownloadSignature({
        secret,
        tenantId,
        userId: session.userId,
        documentId: document.document_id,
        disposition,
        exp: queryParsed.data.exp,
      });

      if (!isValidSignature(expectedSig, queryParsed.data.sig)) {
        return NextResponse.json(
          errorResponse(
            "INVALID_DOWNLOAD_SIGNATURE",
            "Assinatura de download invalida.",
            correlationId,
          ),
          { status: 403 },
        );
      }

      try {
        const fileBuffer = await readDocumentArtifactFn(document.storage_key);

        try {
          await writeDocumentDownloadAuditFn({
            tenantId,
            actorId: session.userId,
            documentId: document.document_id,
            status: "success",
            correlationId,
            ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
            details: {
              document_type: document.document_type,
              period_ref: document.period_ref,
              disposition,
              expires_at: new Date(queryParsed.data.exp * 1000).toISOString(),
            },
          });
        } catch {
          return NextResponse.json(
            errorResponse(
              "AUDIT_LOG_WRITE_FAILED",
              "Nao foi possivel concluir o registro de auditoria do download.",
              correlationId,
              {
                action: "employee.document.download.v1",
                document_id: document.document_id,
              },
              tenantId,
            ),
            { status: 503 },
          );
        }

        return new NextResponse(new Uint8Array(fileBuffer), {
          status: 200,
          headers: {
            "content-type": document.mime_type,
            "content-length": String(fileBuffer.byteLength),
            "cache-control": "no-store",
            "content-disposition": `${disposition}; filename="${document.file_name}"`,
            [CORRELATION_ID_HEADER]: correlationId,
          },
        });
      } catch (error) {
        if (error instanceof DocumentStorageError) {
          if (document.content_base64) {
            try {
              const dbBuffer = Buffer.from(document.content_base64, "base64");

              await writeDocumentDownloadAuditFn({
                tenantId,
                actorId: session.userId,
                documentId: document.document_id,
                status: "success",
                correlationId,
                ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
                details: {
                  document_type: document.document_type,
                  period_ref: document.period_ref,
                  disposition,
                  source: "database_fallback",
                  expires_at: new Date(queryParsed.data.exp * 1000).toISOString(),
                },
              });

              return new NextResponse(new Uint8Array(dbBuffer), {
                status: 200,
                headers: {
                  "content-type": document.mime_type,
                  "content-length": String(dbBuffer.byteLength),
                  "cache-control": "no-store",
                  "content-disposition": `${disposition}; filename="${document.file_name}"`,
                  [CORRELATION_ID_HEADER]: correlationId,
                },
              });
            } catch {
              // fall through to the audited unavailable response below
            }
          }

          await writeDocumentDownloadAuditFn({
            tenantId,
            actorId: session.userId,
            documentId: document.document_id,
            status: "failure",
            correlationId,
            ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
            details: {
              reason: "DOCUMENT_ARTIFACT_UNAVAILABLE",
              storage_error_code: error.code,
            },
          }).catch(() => undefined);

          return NextResponse.json(
            errorResponse(
              "DOWNLOAD_UNAVAILABLE",
              "Artefato do documento indisponivel para download no momento.",
              correlationId,
            ),
            { status: 503 },
          );
        }

        throw error;
      }
    }

    const expiresInSeconds = 300;
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    let secret: string;
    try {
      secret = getDownloadSigningSecret();
    } catch {
      return NextResponse.json(
        errorResponse(
          "DOWNLOAD_CONFIGURATION_ERROR",
          "Download temporariamente indisponivel por configuracao.",
          correlationId,
        ),
        { status: 503 },
      );
    }

    const sig = buildDownloadSignature({
      secret,
      tenantId,
      userId: session.userId,
      documentId: document.document_id,
      disposition,
      exp,
    });

    const downloadUrl = new URL(request.nextUrl.pathname, request.nextUrl.origin);
    downloadUrl.searchParams.set("exp", String(exp));
    downloadUrl.searchParams.set("sig", sig);
    downloadUrl.searchParams.set("disposition", disposition);

    if (responseMode === "json") {
      return NextResponse.json(
        successResponse(
          {
            document: {
              document_id: document.document_id,
              document_type: document.document_type,
              period_ref: document.period_ref,
              mime_type: document.mime_type,
              file_name: document.file_name,
            },
            download_url: downloadUrl.toString(),
            expires_at: new Date(exp * 1000).toISOString(),
          },
          correlationId,
          tenantId,
        ),
      );
    }

    return NextResponse.redirect(downloadUrl, { status: 302 });
  } catch (error) {
    if (
      error instanceof DownloadEligibilityError &&
      error.code === "DOCUMENT_NOT_FOUND"
    ) {
      await writeDocumentDownloadAuditFn({
        tenantId,
        actorId: session.userId,
        documentId: paramsParsed.data.documentId,
        status: "failure",
        correlationId,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        details: {
          reason: "DOCUMENT_NOT_FOUND",
        },
      }).catch(() => undefined);

      return NextResponse.json(
        errorResponse(
          "DOCUMENT_NOT_FOUND",
          "Documento nao encontrado para o colaborador autenticado.",
          correlationId,
        ),
        { status: 404 },
      );
    }

    if (
      error instanceof DownloadEligibilityError &&
      error.code === "DOCUMENT_NOT_DOWNLOADABLE"
    ) {
      await writeDocumentDownloadAuditFn({
        tenantId,
        actorId: session.userId,
        documentId: paramsParsed.data.documentId,
        status: "failure",
        correlationId,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        details: {
          reason: "DOCUMENT_NOT_DOWNLOADABLE",
        },
      }).catch(() => undefined);

      return NextResponse.json(
        errorResponse(
          "DOCUMENT_NOT_DOWNLOADABLE",
          "Documento ainda nao esta disponivel para download.",
          correlationId,
        ),
        { status: 409 },
      );
    }

    if (
      error instanceof DownloadEligibilityError &&
      error.code === "DOCUMENT_ARTIFACT_UNAVAILABLE"
    ) {
      await writeDocumentDownloadAuditFn({
        tenantId,
        actorId: session.userId,
        documentId: paramsParsed.data.documentId,
        status: "failure",
        correlationId,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        details: {
          reason: "DOCUMENT_ARTIFACT_UNAVAILABLE",
        },
      }).catch(() => undefined);

      return NextResponse.json(
        errorResponse(
          "DOWNLOAD_UNAVAILABLE",
          "Artefato do documento indisponivel para download no momento.",
          correlationId,
        ),
        { status: 503 },
      );
    }

    return NextResponse.json(
      errorResponse(
        "DOWNLOAD_UNAVAILABLE",
        "Nao foi possivel iniciar o download. Tente novamente em instantes.",
        correlationId,
      ),
      { status: 503 },
    );
  }
}
