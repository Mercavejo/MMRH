import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { employeeDocuments, employeeIdentities } from "@/lib/db/schema";
import {
  buildEmployeeDocumentStorageKey,
  deleteDocumentArtifact,
  readDocumentArtifact,
  writeDocumentArtifact,
} from "@/lib/documents/storage";
import type { BatchRoutingManifestItem } from "@/lib/rh/batches/batch-routing";
import { normalizeReferenceCode } from "@/modules/employee-identity/domain/employee-identity";

type DbLike = Pick<typeof db, "select" | "insert">;

type EmployeeIdentityPublicationTarget = {
  id: string;
  referenceCode: string;
  status: string;
  userId: string | null;
};

export class EmployeeDocumentPublicationError extends Error {
  constructor(
    public readonly code:
      | "REFERENCE_CODE_REQUIRED"
      | "PUBLICATION_TARGET_NOT_FOUND"
      | "PUBLICATION_SOURCE_ARTIFACT_MISSING"
      | "PUBLICATION_ARTIFACT_PAGE_INVALID"
      | "PUBLICATION_ARTIFACT_UNAVAILABLE",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeDocumentPublicationError";
  }
}

function extractMatchedReferenceCode(item: BatchRoutingManifestItem): string {
  const rawCode = item.codigo_colaborador ?? item.employee_identifier;
  const trimmed = rawCode.trim();

  if (!trimmed || item.match_strategy !== "codigo_colaborador") {
    throw new EmployeeDocumentPublicationError(
      "REFERENCE_CODE_REQUIRED",
      "Publicacao segura exige codigo de referencia resolvivel por colaborador.",
      {
        document_id: item.document_id,
        match_strategy: item.match_strategy,
      },
    );
  }

  return normalizeReferenceCode(trimmed);
}

function buildDownloadFileName(documentType: string, periodRef: string): string {
  return `${documentType}-${periodRef}.pdf`;
}

async function loadPublicationTargets(
  tenantId: string,
  referenceCodes: string[],
  dbClient: DbLike,
): Promise<Map<string, EmployeeIdentityPublicationTarget>> {
  if (referenceCodes.length === 0) {
    return new Map();
  }

  const rows = await dbClient
    .select({
      id: employeeIdentities.id,
      referenceCode: employeeIdentities.referenceCode,
      status: employeeIdentities.status,
      userId: employeeIdentities.userId,
    })
    .from(employeeIdentities)
    .where(
      and(
        eq(employeeIdentities.tenantId, tenantId),
        inArray(employeeIdentities.referenceCode, referenceCodes),
      ),
    );

  return new Map(rows.map((row) => [row.referenceCode, row]));
}

async function extractSinglePagePdf(params: {
  sourcePdf: Buffer;
  pageIndex: number;
}): Promise<Buffer> {
  const { getDocumentProxy } = await import("unpdf");
  const proxy = await getDocumentProxy(new Uint8Array(params.sourcePdf));

  if (params.pageIndex < 1 || params.pageIndex > proxy.numPages) {
    throw new EmployeeDocumentPublicationError(
      "PUBLICATION_ARTIFACT_PAGE_INVALID",
      "Pagina de origem do documento nao pode ser resolvida com seguranca.",
      {
        page_index: params.pageIndex,
        total_pages: proxy.numPages,
      },
    );
  }

  const singlePagePdf = await proxy.extractPages([
    {
      document: new Uint8Array(params.sourcePdf),
      includePages: [params.pageIndex - 1],
    },
  ]);

  return Buffer.from(singlePagePdf);
}

export async function publishEmployeeDocumentsForBatch(
  input: {
    tenantId: string;
    batchId: string;
    sourceStorageKey: string | null;
    sourceStorageFilename: string | null;
    sourceStorageMimeType: string | null;
    routingManifest: BatchRoutingManifestItem[];
  },
  dbClient: DbLike = db,
): Promise<{ publishedCount: number }> {
  if (!input.sourceStorageKey || !input.sourceStorageFilename || !input.sourceStorageMimeType) {
    throw new EmployeeDocumentPublicationError(
      "PUBLICATION_SOURCE_ARTIFACT_MISSING",
      "Lote publicado sem artefato-fonte privado resolvivel.",
      { batch_id: input.batchId },
    );
  }

  const matchedItems = input.routingManifest.filter(
    (item) => item.match_strategy !== null,
  );

  const referenceCodes = Array.from(
    new Set(matchedItems.map((item) => extractMatchedReferenceCode(item))),
  );
  const targets = await loadPublicationTargets(input.tenantId, referenceCodes, dbClient);
  const sourcePdfBuffer = await readDocumentArtifact(input.sourceStorageKey).catch((error) => {
    if (error instanceof Error) {
      throw new EmployeeDocumentPublicationError(
        "PUBLICATION_SOURCE_ARTIFACT_MISSING",
        "Artefato-fonte do lote nao pode ser lido para publicacao.",
        {
          batch_id: input.batchId,
          cause: error.message,
        },
      );
    }

    throw error;
  });

  const values: Array<{
    tenantId: string;
    userId: string;
    batchId: string;
    documentType: string;
    periodRef: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    sourcePageIndex: number;
    contentBase64: string;
    status: "published";
    updatedAt: Date;
  }> = [];
  const createdStorageKeys: string[] = [];

  try {
    for (const item of matchedItems) {
      const referenceCode = extractMatchedReferenceCode(item);
      const target = targets.get(referenceCode);

      if (!target || target.status !== "active" || !target.userId) {
        throw new EmployeeDocumentPublicationError(
          "PUBLICATION_TARGET_NOT_FOUND",
          "Documento nao pode ser publicado sem colaborador ativado e vinculado.",
          {
            document_id: item.document_id,
            reference_code: referenceCode,
          },
        );
      }

      if (!item.page_index || item.page_index < 1) {
        throw new EmployeeDocumentPublicationError(
          "PUBLICATION_ARTIFACT_PAGE_INVALID",
          "Documento sem pagina consistente nao pode ser publicado.",
          {
            document_id: item.document_id,
            page_index: item.page_index ?? null,
          },
        );
      }

      const fileName = buildDownloadFileName(item.document_type, item.period_ref);
      const storageKey = buildEmployeeDocumentStorageKey({
        tenantId: input.tenantId,
        batchId: input.batchId,
        documentId: item.document_id,
        pageIndex: item.page_index,
        fileName,
        mimeType: "application/pdf",
      });
      const fileBuffer = await extractSinglePagePdf({
        sourcePdf: sourcePdfBuffer,
        pageIndex: item.page_index,
      }).catch((error) => {
        if (error instanceof EmployeeDocumentPublicationError) {
          throw error;
        }

        throw new EmployeeDocumentPublicationError(
          "PUBLICATION_ARTIFACT_UNAVAILABLE",
          "Nao foi possivel materializar artefato PDF individual do colaborador.",
          {
            document_id: item.document_id,
            page_index: item.page_index,
            cause: error instanceof Error ? error.message : "unknown_error",
          },
        );
      });

      await writeDocumentArtifact({
        storageKey,
        content: fileBuffer,
      }).catch((error) => {
        throw new EmployeeDocumentPublicationError(
          "PUBLICATION_ARTIFACT_UNAVAILABLE",
          "Nao foi possivel persistir artefato PDF individual do colaborador.",
          {
            document_id: item.document_id,
            page_index: item.page_index,
            cause: error instanceof Error ? error.message : "unknown_error",
          },
        );
      });
      createdStorageKeys.push(storageKey);

      values.push({
        tenantId: input.tenantId,
        userId: target.userId,
        batchId: input.batchId,
        documentType: item.document_type,
        periodRef: item.period_ref,
        storageKey,
        fileName,
        mimeType: "application/pdf",
        sourcePageIndex: item.page_index,
        contentBase64: fileBuffer.toString("base64"),
        status: "published",
        updatedAt: new Date(),
      });
    }

    if (values.length > 0) {
      await dbClient.insert(employeeDocuments).values(values);
    }
  } catch (error) {
    await Promise.all(createdStorageKeys.map((storageKey) => deleteDocumentArtifact(storageKey).catch(() => undefined)));
    throw error;
  }

  return { publishedCount: matchedItems.length };
}
