import { and, eq } from "drizzle-orm";
import { Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { tokens } from "@/lib/theme/tokens";
import { listExternalIngestions } from "@/modules/integrations/application/list-external-ingestions";
import { ExternalIngestionError } from "@/modules/integrations/application/register-external-ingestion";
import { IntegrationStatusPanel } from "@/components/integrations/integration-status-panel";
import type { ExternalIngestion } from "@/modules/integrations/domain/external-ingestion";

type RhIntegrationsSearchParams = {
  ingestion_id?: string;
  status?: string;
  source_system?: string;
};

type IntegrationFilters = {
  ingestion_id: string;
  status: string;
  source_system: string;
};

export function buildIntegrationFilters(searchParams?: RhIntegrationsSearchParams): IntegrationFilters {
  return {
    ingestion_id: searchParams?.ingestion_id ?? "",
    status: searchParams?.status ?? "",
    source_system: searchParams?.source_system ?? "",
  };
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function loadIntegrationData(filters: IntegrationFilters) {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return {
      ingestions: [] as ExternalIngestion[],
      selectedIngestion: null as ExternalIngestion | null,
      metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
      isEmpty: true,
      errorMessage: "Sessao ausente.",
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      ingestions: [] as ExternalIngestion[],
      selectedIngestion: null as ExternalIngestion | null,
      metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
      isEmpty: true,
      errorMessage: "Sessao invalida ou expirada.",
    };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return {
      ingestions: [] as ExternalIngestion[],
      selectedIngestion: null as ExternalIngestion | null,
      metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
      isEmpty: true,
      errorMessage: "Usuario sem permissao no tenant.",
    };
  }

  const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "admin_plataforma"];

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });

    if (!allowedRoles.includes(role)) {
      return {
        ingestions: [] as ExternalIngestion[],
        selectedIngestion: null as ExternalIngestion | null,
        metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
        isEmpty: true,
        errorMessage: "Perfil sem permissao para consultar integracoes externas.",
      };
    }

    const result = await listExternalIngestions({
      tenantId: session.tenantId,
      status: filters.status || undefined,
      sourceSystem: filters.source_system || undefined,
      ingestionId: filters.ingestion_id || undefined,
    });

    return {
      ingestions: result.ingestions,
      selectedIngestion: result.selectedIngestion,
      metadata: result.metadata,
      isEmpty: result.metadata.total === 0,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return {
        ingestions: [] as ExternalIngestion[],
        selectedIngestion: null as ExternalIngestion | null,
        metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
        isEmpty: true,
        errorMessage: error.message,
      };
    }

    return {
      ingestions: [] as ExternalIngestion[],
      selectedIngestion: null as ExternalIngestion | null,
      metadata: { total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 },
      isEmpty: true,
      errorMessage: "Falha ao carregar integracoes externas.",
    };
  }
}

export function RhIntegrationsView(props: {
  filters: IntegrationFilters;
  ingestions: ExternalIngestion[];
  selectedIngestion: ExternalIngestion | null;
  metadata: {
    total: number;
    received_count: number;
    processing_count: number;
    processed_count: number;
    failed_count: number;
  };
  isEmpty: boolean;
  errorMessage?: string | null;
}) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            border: `1px solid ${tokens.colors.surface.border}`,
            background: `linear-gradient(135deg, ${tokens.colors.surface.card} 0%, #eef6ff 100%)`,
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
              Operacao RH / Integracoes
            </Typography>
            <Typography variant="h2">Status de integracoes externas</Typography>
            <Typography variant="body1" color="text.secondary">
              Acompanhe ingestoes recebidas por origem autorizada, com status, referencia externa e recomendacao operacional.
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack component="form" method="get" spacing={2} noValidate>
            <Typography variant="h6">Filtros de integracao</Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Ingestion ID" name="ingestion_id" defaultValue={props.filters.ingestion_id} fullWidth />
              <TextField label="Status" name="status" defaultValue={props.filters.status} fullWidth />
              <TextField label="Origem" name="source_system" defaultValue={props.filters.source_system} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button type="submit" variant="contained">
                Aplicar filtros
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <IntegrationStatusPanel
          ingestions={props.ingestions}
          selectedIngestion={props.selectedIngestion}
          metadata={props.metadata}
          errorMessage={props.errorMessage}
          isLoading={false}
        />
      </Stack>
    </Container>
  );
}

export default async function RhIntegrationsPage({ searchParams }: { searchParams?: RhIntegrationsSearchParams }) {
  const filters = buildIntegrationFilters(searchParams);
  const data = await loadIntegrationData(filters);

  return (
    <RhIntegrationsView
      filters={filters}
      ingestions={data.ingestions}
      selectedIngestion={data.selectedIngestion}
      metadata={data.metadata}
      isEmpty={data.isEmpty}
      errorMessage={data.errorMessage}
    />
  );
}
