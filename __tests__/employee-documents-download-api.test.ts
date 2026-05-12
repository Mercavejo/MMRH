import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DownloadEligibilityError } from "@/lib/documents/get-downloadable-document";
import { handleEmployeeDocumentDownload } from "@/lib/documents/employee-download-handler";
import { DocumentStorageError } from "@/lib/documents/storage";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type MockDeps = {
  validateSessionFn: ReturnType<typeof vi.fn>;
  getDownloadableDocumentFn: ReturnType<typeof vi.fn>;
  readDocumentArtifactFn: ReturnType<typeof vi.fn>;
  assertTenantActionFn: ReturnType<typeof vi.fn>;
  resolveRoleFn: ReturnType<typeof vi.fn>;
  writeDocumentDownloadAuditFn: ReturnType<typeof vi.fn>;
};

function buildDeps(): MockDeps {
  return {
    validateSessionFn: vi.fn(),
    getDownloadableDocumentFn: vi.fn(),
    readDocumentArtifactFn: vi.fn(),
    assertTenantActionFn: vi.fn(),
    resolveRoleFn: vi.fn(),
    writeDocumentDownloadAuditFn: vi.fn(),
  };
}

describe("employee documents download api", () => {
  let deps: MockDeps;

  beforeEach(() => {
    process.env.DOWNLOAD_SIGNING_SECRET = "test-download-secret";

    deps = buildDeps();

    deps.validateSessionFn.mockResolvedValue({
      userId: USER_ID,
      tenantId: SESSION_TENANT_ID,
    });

    deps.resolveRoleFn.mockResolvedValue("colaborador");

    deps.getDownloadableDocumentFn.mockResolvedValue({
      document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      document_type: "holerite",
      period_ref: "2026-03",
      mime_type: "application/pdf",
      file_name: "holerite-2026-03.pdf",
      storage_key: "documents/internal/path.pdf",
      content_base64: null,
    });

    deps.writeDocumentDownloadAuditFn.mockResolvedValue(undefined);
    deps.readDocumentArtifactFn.mockResolvedValue(Buffer.from("%PDF-real-download%"));
  });

  it("returns signed download metadata without exposing storage key", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.document.document_id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(body.data.download_url).toContain("sig=");
    expect(body.data.document.storage_key).toBeUndefined();
    expect(deps.writeDocumentDownloadAuditFn).not.toHaveBeenCalled();
  });

  it("rejects invalid document id", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/invalid/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "invalid",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects missing session", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid session with session cookie", async () => {
    deps.validateSessionFn.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non colaborador role", async () => {
    deps.resolveRoleFn.mockResolvedValue("rh_operator");

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("derives tenant scope from session and ignores tenant query params", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.document.document_id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
  });

  it("maps not downloadable error", async () => {
    deps.getDownloadableDocumentFn.mockRejectedValue(
      new DownloadEligibilityError(
        "DOCUMENT_NOT_DOWNLOADABLE",
        "Documento ainda nao esta publicado.",
      ),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(request, {
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }, deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("DOCUMENT_NOT_DOWNLOADABLE");
  });

  it("returns fail-safe error when signed download audit write fails", async () => {
    const initRequest = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const initResponse = await handleEmployeeDocumentDownload(
      initRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const initBody = await initResponse.json();
    const signedUrl = new URL(initBody.data.download_url as string);

    deps.writeDocumentDownloadAuditFn.mockRejectedValue(
      new Error("audit unavailable"),
    );

    const signedRequest = new NextRequest(signedUrl.toString(), {
      headers: {
        cookie: "session_id=token",
      },
    });

    const response = await handleEmployeeDocumentDownload(
      signedRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("AUDIT_LOG_WRITE_FAILED");
  });

  it("consumes signed URL and returns downloadable response", async () => {
    const initRequest = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const initResponse = await handleEmployeeDocumentDownload(
      initRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const initBody = await initResponse.json();
    const signedUrl = new URL(initBody.data.download_url as string);

    const signedRequest = new NextRequest(signedUrl.toString(), {
      headers: {
        cookie: "session_id=token",
      },
    });

    const signedResponse = await handleEmployeeDocumentDownload(
      signedRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );

    expect(signedResponse.status).toBe(200);
    expect(Buffer.from(await signedResponse.arrayBuffer()).toString()).toBe(
      "%PDF-real-download%",
    );
    expect(signedResponse.headers.get("content-type")).toBe("application/pdf");
    expect(signedResponse.headers.get("content-disposition")).toContain(
      "attachment; filename=\"holerite-2026-03.pdf\"",
    );
    expect(deps.writeDocumentDownloadAuditFn).toHaveBeenCalledTimes(1);
    expect(deps.writeDocumentDownloadAuditFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );
  });

  it("returns 503 when signed download cannot read private artifact", async () => {
    deps.readDocumentArtifactFn.mockRejectedValue(
      new DocumentStorageError(
        "DOCUMENT_STORAGE_NOT_FOUND",
        "Artefato ausente.",
      ),
    );

    const initRequest = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const initResponse = await handleEmployeeDocumentDownload(
      initRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const initBody = await initResponse.json();
    const signedUrl = new URL(initBody.data.download_url as string);

    const signedRequest = new NextRequest(signedUrl.toString(), {
      headers: {
        cookie: "session_id=token",
      },
    });

    const signedResponse = await handleEmployeeDocumentDownload(
      signedRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const signedBody = await signedResponse.json();

    expect(signedResponse.status).toBe(503);
    expect(signedBody.error.code).toBe("DOWNLOAD_UNAVAILABLE");
  });

  it("uses database content fallback when private artifact is unavailable", async () => {
    deps.getDownloadableDocumentFn.mockResolvedValue({
      document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      document_type: "holerite",
      period_ref: "2026-03",
      mime_type: "application/pdf",
      file_name: "holerite-2026-03.pdf",
      storage_key: "documents/internal/path.pdf",
      content_base64: Buffer.from("%PDF-db-fallback%").toString("base64"),
    });
    deps.readDocumentArtifactFn.mockRejectedValue(
      new DocumentStorageError(
        "DOCUMENT_STORAGE_NOT_FOUND",
        "Artefato ausente.",
      ),
    );

    const initRequest = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const initResponse = await handleEmployeeDocumentDownload(
      initRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );
    const initBody = await initResponse.json();
    const signedUrl = new URL(initBody.data.download_url as string);

    const signedRequest = new NextRequest(signedUrl.toString(), {
      headers: {
        cookie: "session_id=token",
      },
    });

    const signedResponse = await handleEmployeeDocumentDownload(
      signedRequest,
      {
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      deps,
    );

    expect(signedResponse.status).toBe(200);
    expect(Buffer.from(await signedResponse.arrayBuffer()).toString()).toBe(
      "%PDF-db-fallback%",
    );
    expect(deps.writeDocumentDownloadAuditFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        details: expect.objectContaining({ source: "database_fallback" }),
      }),
    );
  });
});
