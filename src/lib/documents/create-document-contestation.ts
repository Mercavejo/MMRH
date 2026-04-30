import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentContestations, employeeDocuments } from "@/lib/db/schema";
import type { DocumentStatus } from "@/lib/documents/status-mapping";

export type ContestationTrackingStatus = "open" | "in_progress" | "resolved";
export type ContestableDocumentStatus = "pending" | "unavailable" | "error";

type DocumentContext = {
  id: string;
  tenantId: string;
  userId: string;
  periodRef: string;
  documentType: string;
  status: DocumentStatus;
};

type CreateContestationInsertInput = {
  tenantId: string;
  userId: string;
  documentId: string;
  periodRef: string;
  documentType: string;
  sourceStatus: ContestableDocumentStatus;
  reason: string;
  batchId?: string;
};

type CreateContestationDeps = {
  findDocumentContext: (params: {
    tenantId: string;
    userId: string;
    documentId: string;
  }) => Promise<DocumentContext | null>;
  insertContestation: (input: CreateContestationInsertInput) => Promise<{
    id: string;
    trackingStatus: ContestationTrackingStatus;
    createdAt: Date;
  }>;
};

export class DocumentContestationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DocumentContestationError";
  }
}

function toContestableStatus(status: DocumentStatus): ContestableDocumentStatus {
  if (status === "pending" || status === "unavailable" || status === "error") {
    return status;
  }

  if (status === "published") {
    throw new DocumentContestationError(
      "CONTESTATION_NOT_ALLOWED_FOR_PUBLISHED",
      "Documento publicado nao pode receber contestacao.",
      409,
    );
  }

  throw new DocumentContestationError(
    "CONTESTATION_NOT_ALLOWED_FOR_STATUS",
    "Status do documento nao permite abertura de contestacao.",
    409,
    { status },
  );
}

const defaultDeps: CreateContestationDeps = {
  findDocumentContext: async ({ tenantId, userId, documentId }) => {
    const rows = await db
      .select({
        id: employeeDocuments.id,
        tenantId: employeeDocuments.tenantId,
        userId: employeeDocuments.userId,
        periodRef: employeeDocuments.periodRef,
        documentType: employeeDocuments.documentType,
        status: employeeDocuments.status,
      })
      .from(employeeDocuments)
      .where(
        and(
          eq(employeeDocuments.id, documentId),
          eq(employeeDocuments.tenantId, tenantId),
          eq(employeeDocuments.userId, userId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      periodRef: row.periodRef,
      documentType: row.documentType,
      status: row.status as DocumentStatus,
    };
  },
  insertContestation: async (input) => {
    const now = new Date();
    const rows = await db
      .insert(documentContestations)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        documentId: input.documentId,
        periodRef: input.periodRef,
        documentType: input.documentType,
        sourceStatus: input.sourceStatus,
        batchId: input.batchId,
        reason: input.reason,
        trackingStatus: "open",
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: documentContestations.id,
        trackingStatus: documentContestations.trackingStatus,
        createdAt: documentContestations.createdAt,
      });

    const created = rows[0];
    if (!created) {
      throw new DocumentContestationError(
        "CONTESTATION_INSERT_FAILED",
        "Nao foi possivel criar contestacao.",
        500,
      );
    }

    return {
      id: created.id,
      trackingStatus: created.trackingStatus,
      createdAt: created.createdAt,
    };
  },
};

export async function createDocumentContestation(
  input: {
    tenantId: string;
    userId: string;
    documentId: string;
    reason?: string;
    batchId?: string;
  },
  deps: CreateContestationDeps = defaultDeps,
): Promise<{
  contestation_id: string;
  tenant_id: string;
  user_id: string;
  document_id: string;
  period_ref: string;
  document_type: string;
  source_status: ContestableDocumentStatus;
  tracking_status: ContestationTrackingStatus;
  batch_id: string | null;
  reason: string;
  created_at: string;
}> {
  const context = await deps.findDocumentContext({
    tenantId: input.tenantId,
    userId: input.userId,
    documentId: input.documentId,
  });

  if (!context) {
    throw new DocumentContestationError(
      "DOCUMENT_NOT_FOUND",
      "Documento nao encontrado no escopo do colaborador.",
      404,
    );
  }

  const sourceStatus = toContestableStatus(context.status);
  const reason = input.reason?.trim() || "Contestacao contextual aberta pelo colaborador.";

  const created = await deps.insertContestation({
    tenantId: context.tenantId,
    userId: context.userId,
    documentId: context.id,
    periodRef: context.periodRef,
    documentType: context.documentType,
    sourceStatus,
    reason,
    batchId: input.batchId,
  });

  return {
    contestation_id: created.id,
    tenant_id: context.tenantId,
    user_id: context.userId,
    document_id: context.id,
    period_ref: context.periodRef,
    document_type: context.documentType,
    source_status: sourceStatus,
    tracking_status: created.trackingStatus,
    batch_id: input.batchId ?? null,
    reason,
    created_at: created.createdAt.toISOString(),
  };
}
