import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DownloadEligibilityError } from "@/lib/documents/get-downloadable-document";
import { handleEmployeeDocumentDownload } from "@/lib/documents/employee-download-handler";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type MockDeps = {
  validateSessionFn: ReturnType<typeof vi.fn>;
  getDownloadableDocumentFn: ReturnType<typeof vi.fn>;
  assertTenantActionFn: ReturnType<typeof vi.fn>;
  resolveRoleFn: ReturnType<typeof vi.fn>;
  writeDocumentDownloadAuditFn: ReturnType<typeof vi.fn>;
};

function buildDeps(): MockDeps {
  return {
    validateSessionFn: vi.fn(),
    getDownloadableDocumentFn: vi.fn(),
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
    });

    deps.writeDocumentDownloadAuditFn.mockResolvedValue(undefined);
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

  it("returns fail-safe error when audit write fails after eligibility success", async () => {
    deps.writeDocumentDownloadAuditFn.mockRejectedValue(
      new Error("audit unavailable"),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/download?response=json",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await handleEmployeeDocumentDownload(
      request,
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
    expect(await signedResponse.text()).not.toContain("storage_key=");
    expect(signedResponse.headers.get("content-disposition")).toContain(
      "attachment; filename=\"holerite-2026-03.pdf\"",
    );
  });
});
