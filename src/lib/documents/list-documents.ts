import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { employeeDocuments } from "@/lib/db/schema";
import {
  getDocumentStatusPresentation,
  type DocumentStatus,
} from "@/lib/documents/status-mapping";

type ListDocumentsInput = {
  tenantId: string;
  userId: string;
  periodRef?: string;
  documentType?: string;
};

type DbLike = {
  select: (...args: unknown[]) => {
    from: (...args: unknown[]) => {
      where: (...args: unknown[]) => {
        orderBy: (...args: unknown[]) => Promise<
          Array<{
            id: string;
            tenantId: string;
            userId: string;
            documentType: string;
            periodRef: string;
            status: string;
            createdAt: Date;
          }>
        >;
      };
    };
  };
};

export type EmployeeDocumentListItem = {
  document_id: string;
  tenant_id: string;
  user_id: string;
  document_type: string;
  period_ref: string;
  status: DocumentStatus;
  status_label: string;
  status_a11y_text: string;
  created_at: string;
};

export async function listEmployeeDocuments(
  input: ListDocumentsInput,
  dbClient: DbLike = db as unknown as DbLike,
): Promise<EmployeeDocumentListItem[]> {
  const conditions = [
    eq(employeeDocuments.tenantId, input.tenantId),
    eq(employeeDocuments.userId, input.userId),
  ];

  if (input.periodRef) {
    conditions.push(eq(employeeDocuments.periodRef, input.periodRef));
  }

  if (input.documentType) {
    conditions.push(eq(employeeDocuments.documentType, input.documentType));
  }

  const rows = await dbClient
    .select({
      id: employeeDocuments.id,
      tenantId: employeeDocuments.tenantId,
      userId: employeeDocuments.userId,
      documentType: employeeDocuments.documentType,
      periodRef: employeeDocuments.periodRef,
      status: employeeDocuments.status,
      createdAt: employeeDocuments.createdAt,
    })
    .from(employeeDocuments)
    .where(and(...conditions))
    .orderBy(desc(employeeDocuments.createdAt));

  return rows
    .filter((row) => row.tenantId === input.tenantId && row.userId === input.userId)
    .filter((row) => (input.periodRef ? row.periodRef === input.periodRef : true))
    .filter((row) =>
      input.documentType ? row.documentType === input.documentType : true,
    )
    .map((row) => {
      const presentation = getDocumentStatusPresentation(
        row.status as DocumentStatus,
      );

      return {
        document_id: row.id,
        tenant_id: row.tenantId,
        user_id: row.userId,
        document_type: row.documentType,
        period_ref: row.periodRef,
        status: row.status as DocumentStatus,
        status_label: presentation.label,
        status_a11y_text: presentation.a11yText,
        created_at: row.createdAt.toISOString(),
      };
    });
}