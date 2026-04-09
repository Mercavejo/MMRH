import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { documentContestations } from "@/lib/db/schema";
import {
  DocumentContestationError,
  type ContestationTrackingStatus,
} from "@/lib/documents/create-document-contestation";

const TRACKING_TRANSITIONS: Record<
  ContestationTrackingStatus,
  ContestationTrackingStatus[]
> = {
  open: ["open", "in_progress", "resolved"],
  in_progress: ["in_progress", "resolved"],
  resolved: ["resolved"],
};

type TrackingDeps = {
  getContestationByIdAndTenant: (params: {
    tenantId: string;
    contestationId: string;
  }) => Promise<{
    id: string;
    trackingStatus: ContestationTrackingStatus;
  } | null>;
  updateContestation: (input: {
    tenantId: string;
    contestationId: string;
    nextStatus: ContestationTrackingStatus;
    actorId: string;
    resolutionNote?: string;
  }) => Promise<{
    id: string;
    trackingStatus: ContestationTrackingStatus;
    updatedAt: Date;
    resolvedBy?: string | null;
  }>;
};

const defaultDeps: TrackingDeps = {
  getContestationByIdAndTenant: async ({ tenantId, contestationId }) => {
    const rows = await db
      .select({
        id: documentContestations.id,
        trackingStatus: documentContestations.trackingStatus,
      })
      .from(documentContestations)
      .where(
        and(
          eq(documentContestations.id, contestationId),
          eq(documentContestations.tenantId, tenantId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      trackingStatus: row.trackingStatus,
    };
  },
  updateContestation: async (input) => {
    const now = new Date();
    const rows = await db
      .update(documentContestations)
      .set({
        trackingStatus: input.nextStatus,
        resolutionNote: input.resolutionNote,
        resolvedAt: input.nextStatus === "resolved" ? now : null,
        resolvedBy: input.nextStatus === "resolved" ? input.actorId : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(documentContestations.id, input.contestationId),
          eq(documentContestations.tenantId, input.tenantId),
        ),
      )
      .returning({
        id: documentContestations.id,
        trackingStatus: documentContestations.trackingStatus,
        updatedAt: documentContestations.updatedAt,
        resolvedBy: documentContestations.resolvedBy,
      });

    const updated = rows[0];
    if (!updated) {
      throw new DocumentContestationError(
        "CONTESTATION_NOT_FOUND",
        "Contestacao nao encontrada para atualizacao.",
        404,
      );
    }

    return {
      id: updated.id,
      trackingStatus: updated.trackingStatus,
      updatedAt: updated.updatedAt,
      resolvedBy: updated.resolvedBy,
    };
  },
};

export function isValidContestationTrackingTransition(
  currentStatus: ContestationTrackingStatus,
  nextStatus: ContestationTrackingStatus,
): boolean {
  return TRACKING_TRANSITIONS[currentStatus].includes(nextStatus);
}

export async function listContestationsForTenant(input: {
  tenantId: string;
  trackingStatus?: ContestationTrackingStatus;
  periodRef?: string;
}) {
  const conditions = [eq(documentContestations.tenantId, input.tenantId)];

  if (input.trackingStatus) {
    conditions.push(eq(documentContestations.trackingStatus, input.trackingStatus));
  }

  if (input.periodRef) {
    conditions.push(eq(documentContestations.periodRef, input.periodRef));
  }

  const rows = await db
    .select({
      id: documentContestations.id,
      tenantId: documentContestations.tenantId,
      userId: documentContestations.userId,
      documentId: documentContestations.documentId,
      periodRef: documentContestations.periodRef,
      documentType: documentContestations.documentType,
      sourceStatus: documentContestations.sourceStatus,
      trackingStatus: documentContestations.trackingStatus,
      batchId: documentContestations.batchId,
      reason: documentContestations.reason,
      resolutionNote: documentContestations.resolutionNote,
      resolvedBy: documentContestations.resolvedBy,
      resolvedAt: documentContestations.resolvedAt,
      createdAt: documentContestations.createdAt,
      updatedAt: documentContestations.updatedAt,
    })
    .from(documentContestations)
    .where(and(...conditions))
    .orderBy(desc(documentContestations.createdAt));

  return rows.map((row) => ({
    contestation_id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    document_id: row.documentId,
    period_ref: row.periodRef,
    document_type: row.documentType,
    source_status: row.sourceStatus,
    tracking_status: row.trackingStatus,
    batch_id: row.batchId,
    reason: row.reason,
    resolution_note: row.resolutionNote,
    resolved_by: row.resolvedBy,
    resolved_at: row.resolvedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }));
}

export async function updateContestationTrackingStatus(
  input: {
    tenantId: string;
    contestationId: string;
    actorId: string;
    nextStatus: ContestationTrackingStatus;
    resolutionNote?: string;
  },
  deps: TrackingDeps = defaultDeps,
) {
  const existing = await deps.getContestationByIdAndTenant({
    tenantId: input.tenantId,
    contestationId: input.contestationId,
  });

  if (!existing) {
    throw new DocumentContestationError(
      "CONTESTATION_NOT_FOUND",
      "Contestacao nao encontrada no tenant informado.",
      404,
    );
  }

  if (
    !isValidContestationTrackingTransition(
      existing.trackingStatus,
      input.nextStatus,
    )
  ) {
    throw new DocumentContestationError(
      "INVALID_CONTESTATION_STATUS_TRANSITION",
      "Transicao de status de contestacao invalida.",
      409,
      {
        current_status: existing.trackingStatus,
        next_status: input.nextStatus,
      },
    );
  }

  const updated = await deps.updateContestation({
    tenantId: input.tenantId,
    contestationId: input.contestationId,
    nextStatus: input.nextStatus,
    actorId: input.actorId,
    resolutionNote: input.resolutionNote,
  });

  return {
    contestation_id: updated.id,
    tracking_status: updated.trackingStatus,
    resolved_by: updated.resolvedBy ?? null,
    updated_at: updated.updatedAt.toISOString(),
  };
}
