import { describe, expect, it } from "vitest";
import {
  createDocumentContestation,
  DocumentContestationError,
} from "@/lib/documents/create-document-contestation";
import {
  isValidContestationTrackingTransition,
  updateContestationTrackingStatus,
} from "@/lib/documents/contestation-tracking";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createCreateDeps(overrides?: {
  findDocumentContext?: () => Promise<{
    id: string;
    tenantId: string;
    userId: string;
    documentType: string;
    periodRef: string;
    status: "pending" | "unavailable" | "error" | "published";
  } | null>;
  insertContestation?: (input: {
    tenantId: string;
    userId: string;
    documentId: string;
    documentType: string;
    periodRef: string;
    sourceStatus: "pending" | "unavailable" | "error";
    reason: string;
    batchId?: string;
  }) => Promise<{
    id: string;
    trackingStatus: "open" | "in_progress" | "resolved";
    createdAt: Date;
  }>;
}) {
  return {
    findDocumentContext:
      overrides?.findDocumentContext ??
      (async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: TENANT_ID,
        userId: USER_ID,
        documentType: "holerite",
        periodRef: "2026-03",
        status: "pending",
      })),
    insertContestation:
      overrides?.insertContestation ??
      (async () => ({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        trackingStatus: "open",
        createdAt: new Date("2026-04-09T10:30:00.000Z"),
      })),
  };
}

describe("document contestation domain", () => {
  it("creates contestation with auto-filled context from employee document", async () => {
    const result = await createDocumentContestation(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        reason: "Documento ainda nao apareceu no portal.",
      },
      createCreateDeps(),
    );

    expect(result.document_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(result.period_ref).toBe("2026-03");
    expect(result.document_type).toBe("holerite");
    expect(result.source_status).toBe("pending");
    expect(result.tracking_status).toBe("open");
  });

  it("rejects contestation when the document is outside the collaborator scope", async () => {
    await expect(
      createDocumentContestation(
        {
          tenantId: TENANT_ID,
          userId: USER_ID,
          documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        createCreateDeps({
          findDocumentContext: async () => null,
        }),
      ),
    ).rejects.toMatchObject<Partial<DocumentContestationError>>({
      code: "DOCUMENT_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("rejects contestation for published document", async () => {
    await expect(
      createDocumentContestation(
        {
          tenantId: TENANT_ID,
          userId: USER_ID,
          documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
        createCreateDeps({
          findDocumentContext: async () => ({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            tenantId: TENANT_ID,
            userId: USER_ID,
            documentType: "holerite",
            periodRef: "2026-03",
            status: "published",
          }),
        }),
      ),
    ).rejects.toMatchObject<Partial<DocumentContestationError>>({
      code: "CONTESTATION_NOT_ALLOWED_FOR_PUBLISHED",
      statusCode: 409,
    });
  });

  it("keeps batch linkage when provided", async () => {
    const result = await createDocumentContestation(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        batchId: "lote-fechamento-2026-03",
      },
      createCreateDeps(),
    );

    expect(result.batch_id).toBe("lote-fechamento-2026-03");
  });

  it("validates allowed tracking transitions", () => {
    expect(isValidContestationTrackingTransition("open", "in_progress")).toBe(true);
    expect(isValidContestationTrackingTransition("in_progress", "resolved")).toBe(true);
    expect(isValidContestationTrackingTransition("resolved", "open")).toBe(false);
    expect(isValidContestationTrackingTransition("resolved", "in_progress")).toBe(false);
  });

  it("rejects invalid tracking transition", async () => {
    await expect(
      updateContestationTrackingStatus(
        {
          tenantId: TENANT_ID,
          contestationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          nextStatus: "in_progress",
        },
        {
          getContestationByIdAndTenant: async () => ({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            trackingStatus: "resolved",
          }),
          updateContestation: async () => ({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            trackingStatus: "resolved",
            updatedAt: new Date(),
          }),
        },
      ),
    ).rejects.toMatchObject<Partial<DocumentContestationError>>({
      code: "INVALID_CONTESTATION_STATUS_TRANSITION",
      statusCode: 409,
    });
  });
});
