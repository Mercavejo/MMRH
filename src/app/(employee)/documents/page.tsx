import Link from "next/link";
import {
  Alert,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { type EmployeeDocumentListItem, listEmployeeDocuments } from "@/lib/documents/list-documents";
import { DocumentStatusChip } from "@/lib/documents/document-status-chip";
import type { DocumentStatus } from "@/lib/documents/status-mapping";

type Filters = {
  tenantId?: string;
  periodRef?: string;
  documentType?: string;
};

type SearchParams = {
  period_ref?: string;
  document_type?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export const dynamic = "force-dynamic";

export function serializeDocumentFilters(filters: {
  periodRef?: string;
  documentType?: string;
}) {
  const params = new URLSearchParams();

  if (filters.periodRef) {
    params.set("period_ref", filters.periodRef);
  }

  if (filters.documentType) {
    params.set("document_type", filters.documentType);
  }

  return params.toString();
}

function buildDetailsHref(documentId: string, filters: Filters) {
  const from = serializeDocumentFilters({
    periodRef: filters.periodRef,
    documentType: filters.documentType,
  });

  if (!from) {
    return `/documents/${documentId}`;
  }

  return `/documents/${documentId}?from=${encodeURIComponent(from)}`;
}

function buildDownloadHref(documentId: string) {
  return `/api/v1/employee/documents/${documentId}/download?disposition=attachment`;
}

export function EmployeeDocumentsPageView({
  items,
  activeFilters,
  errorMessage,
}: {
  items: EmployeeDocumentListItem[];
  activeFilters: { periodRef?: string; documentType?: string };
  errorMessage?: string;
}) {
  const currentQuery = serializeDocumentFilters(activeFilters);
  const clearHref = "/documents";

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h2">Meus Documentos</Typography>

          <Stack
            component="form"
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            method="get"
            role="search"
            aria-label="Filtros de documentos"
          >
            <TextField
              name="period_ref"
              label="Periodo (AAAA-MM)"
              defaultValue={activeFilters.periodRef ?? ""}
              slotProps={{
                htmlInput: {
                  pattern: "\\d{4}-(0[1-9]|1[0-2])",
                  "aria-label": "Filtrar por periodo",
                },
              }}
            />

            <TextField
              select
              name="document_type"
              label="Tipo de documento"
              defaultValue={activeFilters.documentType ?? ""}
              slotProps={{
                htmlInput: { "aria-label": "Filtrar por tipo de documento" },
              }}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="holerite">Holerite</MenuItem>
              <MenuItem value="cartao_ponto">Cartao de ponto</MenuItem>
            </TextField>

            <Button type="submit" variant="contained">
              Aplicar filtros
            </Button>

            <Button component={Link} href={clearHref} variant="outlined">
              Limpar
            </Button>
          </Stack>

          {errorMessage ? (
            <Alert severity="error" role="alert">
              {errorMessage}
            </Alert>
          ) : null}

          <Alert severity="info" role="status">
            Se o download falhar, aguarde alguns instantes e tente novamente. Caso o documento ainda nao esteja publicado, abra uma contestacao contextual para o RH.
          </Alert>

          {!errorMessage && items.length === 0 ? (
            <Alert severity="info" role="status">
              Nenhum documento encontrado para os filtros informados.
            </Alert>
          ) : null}

          {!errorMessage && items.length > 0 ? (
            <Stack spacing={2} aria-live="polite">
              {items.map((item) => (
                <Paper
                  key={item.document_id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{
                      display: "flex",
                      alignItems: { xs: "flex-start", md: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {item.document_type}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Periodo: {item.period_ref}
                      </Typography>
                    </Stack>

                    <DocumentStatusChip status={item.status as DocumentStatus} />

                    <Button
                      component={Link}
                      href={buildDownloadHref(item.document_id)}
                      variant="contained"
                      aria-label={`Baixar ${item.document_type} ${item.period_ref}`}
                    >
                      Baixar
                    </Button>

                    <Button
                      component={Link}
                      href={buildDetailsHref(item.document_id, activeFilters)}
                      variant="outlined"
                    >
                      Ver detalhes
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : null}

          {currentQuery ? (
            <Typography variant="body2" color="text.secondary">
              Filtros ativos: {currentQuery}
            </Typography>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
}

async function resolveRole(userId: string, tenantId: string) {
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

  return mappings[0]?.role;
}

export default async function EmployeeDocumentsPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const periodRef = query.period_ref;
  const documentType = query.document_type;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Sessao ausente. Realize login para consultar seus documentos."
      />
    );
  }

  const session = await validateSession(token);
  if (!session) {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Sessao invalida ou expirada. Realize login novamente."
      />
    );
  }

  const role = await resolveRole(session.userId, session.tenantId);
  if (role !== "colaborador") {
    return (
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef, documentType }}
        errorMessage="Acesso permitido somente para colaborador."
      />
    );
  }

  let items: EmployeeDocumentListItem[] = [];
  let errorMessage: string | undefined;

  try {
    items = await listEmployeeDocuments({
      tenantId: session.tenantId,
      userId: session.userId,
      periodRef,
      documentType,
    });
  } catch {
    errorMessage = "Falha ao carregar documentos. Tente novamente em instantes.";
  }

  return (
    <EmployeeDocumentsPageView
      items={items}
      activeFilters={{ periodRef, documentType }}
      errorMessage={errorMessage}
    />
  );
}