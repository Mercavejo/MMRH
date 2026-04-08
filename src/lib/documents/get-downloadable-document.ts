import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { employeeDocuments } from "@/lib/db/schema";
import type { DocumentStatus } from "@/lib/documents/status-mapping";

type GetDownloadableDocumentInput = {
  documentId: string;
  tenantId: string;
  userId: string;
};

type DbLike = {
  select: (...args: unknown[]) => {
    from: (...args: unknown[]) => {
      where: (...args: unknown[]) => {
        limit: (...args: unknown[]) => Promise<
          Array<{
            id: string;
            tenantId: string;
            userId: string;
            documentType: string;
            periodRef: string;
            status: string;
          }>
        >;
      };
    };
  };
};

export type DownloadableDocumentMetadata = {
  document_id: string;
  document_type: string;
  period_ref: string;
  mime_type: string;
  file_name: string;
  storage_key: string;
};

export class DownloadEligibilityError extends Error {
  code: "DOCUMENT_NOT_FOUND" | "DOCUMENT_NOT_DOWNLOADABLE";

  constructor(
    code: "DOCUMENT_NOT_FOUND" | "DOCUMENT_NOT_DOWNLOADABLE",
    message: string,
  ) {
    super(message);
    this.name = "DownloadEligibilityError";
    this.code = code;
  }
}

function resolveDownloadFileName(documentType: string, periodRef: string): string {
  return `${documentType}-${periodRef}.pdf`;
}

function resolveMimeType(): string {
  return "application/pdf";
}

export async function getDownloadableDocument(
  input: GetDownloadableDocumentInput,
  dbClient: DbLike = db as unknown as DbLike,
): Promise<DownloadableDocumentMetadata> {
  const rows = await dbClient
    .select({
      id: employeeDocuments.id,
      tenantId: employeeDocuments.tenantId,
      userId: employeeDocuments.userId,
      documentType: employeeDocuments.documentType,
      periodRef: employeeDocuments.periodRef,
      status: employeeDocuments.status,
    })
    .from(employeeDocuments)
    .where(
      and(
        eq(employeeDocuments.id, input.documentId),
        eq(employeeDocuments.tenantId, input.tenantId),
        eq(employeeDocuments.userId, input.userId),
      ),
    )
    .limit(1);

  const record = rows[0];
  if (!record) {
    throw new DownloadEligibilityError(
      "DOCUMENT_NOT_FOUND",
      "Documento nao encontrado para o escopo informado.",
    );
  }

  if ((record.status as DocumentStatus) !== "published") {
    throw new DownloadEligibilityError(
      "DOCUMENT_NOT_DOWNLOADABLE",
      "Documento ainda nao esta publicado para download.",
    );
  }

  return {
    document_id: record.id,
    document_type: record.documentType,
    period_ref: record.periodRef,
    mime_type: resolveMimeType(),
    file_name: resolveDownloadFileName(record.documentType, record.periodRef),
    storage_key: `documents/${record.tenantId}/${record.userId}/${record.id}.pdf`,
  };
}
