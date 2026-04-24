import { and, eq } from "drizzle-orm";
import { Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { tokens } from "@/lib/theme/tokens";
import {
  getOperationalIndicators,
  OperationalIndicatorsError,
} from "@/modules/indicators/application/get-operational-indicators";
import {
  OperationalIndicatorsDashboard,
  type OperationalIndicatorsViewModel,
} from "@/components/indicators/operational-indicators-dashboard";
import { OperationalAlertsPanel } from "@/components/alerts/operational-alerts-panel";
import {
  getOperationalAlerts,
  OperationalAlertsError,
} from "@/modules/alerts/application/get-operational-alerts";
import type { OperationalAlert } from "@/modules/alerts/domain/operational-alert";

type RhIndicatorsSearchParams = {
  batch_id?: string;
  from?: string;
  to?: string;
  organizational_unit?: string;
  status?: string;
  severity?: string;
};

type IndicatorsPageFilters = {
  batch_id: string;
  from: string;
  to: string;
  organizational_unit: string;
  status: string;
  severity: string;
};

export function buildIndicatorsFilters(
  searchParams?: RhIndicatorsSearchParams,
): IndicatorsPageFilters {
  return {
    batch_id: searchParams?.batch_id ?? "",
    from: searchParams?.from ?? "",
    to: searchParams?.to ?? "",
    organizational_unit: searchParams?.organizational_unit ?? "",
    status: searchParams?.status ?? "",
    severity: searchParams?.severity ?? "",
  };
}

function normalizeDateTimeFilter(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toISOString();
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function loadIndicators(filters: IndicatorsPageFilters) {
  const emptyAlertsMetadata = {
    total: 0,
    open_count: 0,
    in_treatment_count: 0,
    resolved_count: 0,
  };

  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return {
      indicators: null as OperationalIndicatorsViewModel | null,
      alerts: [] as OperationalAlert[],
      alertsMetadata: emptyAlertsMetadata,
      isEmpty: true,
      errorMessage: "Sessao ausente.",
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      indicators: null as OperationalIndicatorsViewModel | null,
      alerts: [] as OperationalAlert[],
      alertsMetadata: emptyAlertsMetadata,
      isEmpty: true,
      errorMessage: "Sessao invalida ou expirada.",
    };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return {
      indicators: null as OperationalIndicatorsViewModel | null,
      alerts: [] as OperationalAlert[],
      alertsMetadata: emptyAlertsMetadata,
      isEmpty: true,
      errorMessage: "Usuario sem permissao no tenant.",
    };
  }

  const allowedRoles: RbacRole[] = ["admin_plataforma"];

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });

    if (!allowedRoles.includes(role)) {
      return {
        indicators: null as OperationalIndicatorsViewModel | null,
        alerts: [] as OperationalAlert[],
        alertsMetadata: emptyAlertsMetadata,
        isEmpty: true,
        errorMessage: "Perfil sem permissao para consultar indicadores operacionais.",
      };
    }

    const normalizedFrom = normalizeDateTimeFilter(filters.from);
    const normalizedTo = normalizeDateTimeFilter(filters.to);

    const data = await getOperationalIndicators({
      tenantId: session.tenantId,
      batchId: filters.batch_id || undefined,
      from: normalizedFrom,
      to: normalizedTo,
      organizationalUnit: filters.organizational_unit || undefined,
    });

    const alerts = await getOperationalAlerts({
      tenantId: session.tenantId,
      batchId: filters.batch_id || undefined,
      from: normalizedFrom,
      to: normalizedTo,
      status: filters.status || undefined,
      severity: filters.severity || undefined,
    });

    return {
      indicators: data.indicators,
      alerts: alerts.alerts as OperationalAlert[],
      alertsMetadata: alerts.metadata,
      isEmpty: data.indicators.totals.totalBatches === 0,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof OperationalIndicatorsError || error instanceof OperationalAlertsError) {
      return {
        indicators: null as OperationalIndicatorsViewModel | null,
        alerts: [] as OperationalAlert[],
        alertsMetadata: emptyAlertsMetadata,
        isEmpty: true,
        errorMessage: error.message,
      };
    }

    return {
      indicators: null as OperationalIndicatorsViewModel | null,
      alerts: [] as OperationalAlert[],
      alertsMetadata: emptyAlertsMetadata,
      isEmpty: true,
      errorMessage: "Falha ao carregar indicadores operacionais.",
    };
  }
}

export function RhOperationalIndicatorsView(props: {
  filters: IndicatorsPageFilters;
  indicators: OperationalIndicatorsViewModel | null;
  alerts: OperationalAlert[];
  alertsMetadata: {
    total: number;
    open_count: number;
    in_treatment_count: number;
    resolved_count: number;
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
            background: `linear-gradient(135deg, ${tokens.colors.surface.card} 0%, #edf4fb 100%)`,
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
              Operacao RH / Indicadores
            </Typography>
            <Typography variant="h2">Dashboard de indicadores e status operacional</Typography>
            <Typography variant="body1" color="text.secondary">
              Acompanhe entrega, acuracia e pendencias com segmentacao por lote, periodo e unidade.
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack component="form" method="get" spacing={2} noValidate>
            <Typography variant="h6">Filtros operacionais</Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Batch ID" name="batch_id" defaultValue={props.filters.batch_id} fullWidth />
              <TextField label="De" name="from" type="datetime-local" defaultValue={props.filters.from} fullWidth />
              <TextField label="Ate" name="to" type="datetime-local" defaultValue={props.filters.to} fullWidth />
              <TextField
                label="Unidade organizacional"
                name="organizational_unit"
                defaultValue={props.filters.organizational_unit}
                fullWidth
              />
              <TextField label="Status alerta" name="status" defaultValue={props.filters.status} fullWidth />
              <TextField
                label="Severidade alerta"
                name="severity"
                defaultValue={props.filters.severity}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button type="submit" variant="contained">Aplicar filtros</Button>
            </Stack>
          </Stack>
        </Paper>

        <OperationalIndicatorsDashboard
          indicators={props.indicators}
          isEmpty={props.isEmpty}
          errorMessage={props.errorMessage}
        />

        <OperationalAlertsPanel
          alerts={props.alerts}
          metadata={props.alertsMetadata}
          errorMessage={props.errorMessage}
        />
      </Stack>
    </Container>
  );
}

export default async function RhOperationalIndicatorsPage({
  searchParams,
}: {
  searchParams?: Promise<RhIndicatorsSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters = buildIndicatorsFilters(resolvedSearchParams);
  const data = await loadIndicators(filters);

  return (
    <RhOperationalIndicatorsView
      filters={filters}
      indicators={data.indicators}
      alerts={data.alerts}
      alertsMetadata={data.alertsMetadata}
      isEmpty={data.isEmpty}
      errorMessage={data.errorMessage}
    />
  );
}
