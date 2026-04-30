import { Alert, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { employeeDocuments } from "@/lib/db/schema";
import type { DocumentStatus } from "@/lib/documents/status-mapping";

type DetailPageProps = {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ from?: string; status?: string }>;
};

export default async function EmployeeDocumentDetailPage({
  params,
  searchParams,
}: DetailPageProps) {
  const { documentId } = await params;
  const { from, status } = await searchParams;

  async function resolveDocumentStatus(): Promise<DocumentStatus | undefined> {
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

      if (!sessionToken) {
        return undefined;
      }

      const session = await validateSession(sessionToken);
      if (!session) {
        return undefined;
      }

      const rows = await db
        .select({ status: employeeDocuments.status })
        .from(employeeDocuments)
        .where(
          and(
            eq(employeeDocuments.id, documentId),
            eq(employeeDocuments.tenantId, session.tenantId),
            eq(employeeDocuments.userId, session.userId),
          ),
        )
        .limit(1);

      return rows[0]?.status as DocumentStatus | undefined;
    } catch {
      return undefined;
    }
  }

  const resolvedStatus = (await resolveDocumentStatus()) ?? status ?? "unavailable";
  const contestationAllowed =
    resolvedStatus === "pending" ||
    resolvedStatus === "unavailable" ||
    resolvedStatus === "error";

  const backHref = from ? `/documents?${from}` : "/documents";
  const downloadHref = `/api/v1/employee/documents/${documentId}/download?disposition=attachment`;
  const contestationQuery = new URLSearchParams({
    document_id: documentId,
    status: resolvedStatus,
  });

  if (from) {
    const fromParams = new URLSearchParams(from);
    const periodRef = fromParams.get("period_ref");
    const documentType = fromParams.get("document_type");

    if (periodRef) {
      contestationQuery.set("period_ref", periodRef);
    }

    if (documentType) {
      contestationQuery.set("document_type", documentType);
    }

    contestationQuery.set("from", from);
  }

  const contestationHref = `/documents/contestacao?${contestationQuery.toString()}`;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h2">Detalhe do Documento</Typography>
          <Typography variant="body1">
            Documento selecionado: <strong>{documentId}</strong>
          </Typography>
          <Alert severity="info" role="status">
            Se o documento nao estiver disponivel para download, verifique o status na lista e use a contestacao guiada quando necessario.
          </Alert>
          <Button
            href={downloadHref}
            variant="contained"
            aria-label={`Baixar documento ${documentId}`}
          >
            Baixar documento
          </Button>
          {contestationAllowed ? (
            <Button
              href={contestationHref}
              variant="outlined"
              color="warning"
              aria-label={`Abrir contestacao para documento ${documentId}`}
            >
              Abrir contestacao
            </Button>
          ) : null}
          <Button href={backHref} variant="outlined">
            Voltar para lista
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
