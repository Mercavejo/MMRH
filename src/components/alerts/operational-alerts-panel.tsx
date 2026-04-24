import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
import { tokens } from "@/lib/theme/tokens";
import type { OperationalAlert } from "@/modules/alerts/domain/operational-alert";

function toneColor(tone: "critical" | "warning" | "info") {
  if (tone === "critical") {
    return tokens.colors.error;
  }

  if (tone === "warning") {
    return tokens.colors.warning;
  }

  return tokens.colors.processing;
}

function statusLabel(status: OperationalAlert["status"]): string {
  if (status === "open") {
    return "Aberto";
  }

  if (status === "in_treatment") {
    return "Em tratamento";
  }

  return "Resolvido";
}

export function OperationalAlertsPanel(props: {
  alerts?: OperationalAlert[];
  metadata?: {
    total: number;
    open_count: number;
    in_treatment_count: number;
    resolved_count: number;
  };
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const alerts = props.alerts ?? [];
  const metadata =
    props.metadata ??
    ({
      total: 0,
      open_count: 0,
      in_treatment_count: 0,
      resolved_count: 0,
    } as const);

  if (props.isLoading) {
    return <Alert severity="info">Carregando alertas operacionais...</Alert>;
  }

  if (props.errorMessage) {
    return <Alert severity="error">{props.errorMessage}</Alert>;
  }

  if (alerts.length === 0) {
    return <Alert severity="info">Nenhum alerta encontrado para os filtros atuais.</Alert>;
  }

  return (
    <Stack spacing={2} aria-live="polite" component="section" aria-label="Painel de alertas operacionais">
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2" id="operational-alerts-heading">
            Alertas operacionais
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip label={`Total: ${metadata.total}`} variant="outlined" />
            <Chip label={`Abertos: ${metadata.open_count}`} variant="outlined" />
            <Chip label={`Em tratamento: ${metadata.in_treatment_count}`} variant="outlined" />
            <Chip label={`Resolvidos: ${metadata.resolved_count}`} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Stack component="ul" spacing={2} sx={{ m: 0, p: 0, listStyle: "none" }} aria-labelledby="operational-alerts-heading">
        {alerts.map((alert) => (
          <Paper
            component="li"
            key={alert.id}
            elevation={0}
            tabIndex={0}
            aria-label={`Alerta ${statusLabel(alert.status)} de severidade ${alert.severity}`}
            sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}
          >
          <Stack spacing={1}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Chip
                label={`Status: ${statusLabel(alert.status)}`}
                sx={{
                  alignSelf: "flex-start",
                  backgroundColor: toneColor(alert.severity),
                  color: tokens.colors.text.inverse,
                }}
              />
              <Chip label={`Severidade: ${alert.severity}`} variant="outlined" />
              <Chip label={`Lote: ${alert.batch_id}`} variant="outlined" />
            </Stack>
            <Typography variant="body2">Causa: {alert.cause_code}</Typography>
            <Typography variant="body2" color="text.secondary">
              Acao recomendada: {alert.recommended_action}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Detectado em: {new Date(alert.detected_at).toLocaleString("pt-BR")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Emissao: {new Date(alert.emitted_at).toLocaleString("pt-BR")} · SLA {alert.is_sla_breached ? "violado" : "ok"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Indicadores visuais tambem sao descritos em texto para acessibilidade.
            </Typography>
          </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
