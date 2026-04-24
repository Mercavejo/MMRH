import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
import { tokens } from "@/lib/theme/tokens";

export type OperationalIndicatorsViewModel = {
  deliveryRate: number;
  routingAccuracy: number;
  pendingCount: number;
  totals: {
    totalBatches: number;
    publishedBatches: number;
    routingTotalItems: number;
    routingMatchedItems: number;
  };
};

function toPercent(value: number): string {
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
}

function resolveDeliveryTone(value: number): "success" | "warning" | "error" {
  if (value >= 0.95) {
    return "success";
  }

  if (value >= 0.85) {
    return "warning";
  }

  return "error";
}

function resolveAccuracyTone(value: number): "success" | "warning" | "error" {
  if (value >= 0.98) {
    return "success";
  }

  if (value >= 0.9) {
    return "warning";
  }

  return "error";
}

function resolvePendingTone(value: number): "success" | "warning" | "error" {
  if (value === 0) {
    return "success";
  }

  if (value <= 10) {
    return "warning";
  }

  return "error";
}

function toneColor(tone: "success" | "warning" | "error") {
  if (tone === "success") return tokens.colors.success;
  if (tone === "warning") return tokens.colors.warning;
  return tokens.colors.error;
}

export function OperationalIndicatorsDashboard(props: {
  indicators: OperationalIndicatorsViewModel | null;
  isEmpty: boolean;
  errorMessage?: string | null;
}) {
  if (props.errorMessage) {
    return <Alert severity="error" role="status">{props.errorMessage}</Alert>;
  }

  if (props.isEmpty || !props.indicators) {
    return (
      <Alert severity="info" role="status">
        Nenhum lote encontrado para os filtros atuais.
      </Alert>
    );
  }

  const deliveryTone = resolveDeliveryTone(props.indicators.deliveryRate);
  const accuracyTone = resolveAccuracyTone(props.indicators.routingAccuracy);
  const pendingTone = resolvePendingTone(props.indicators.pendingCount);

  return (
    <Stack spacing={2} aria-live="polite">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Taxa de entrega</Typography>
            <Typography variant="h4">{toPercent(props.indicators.deliveryRate)}</Typography>
            <Chip
              label={deliveryTone === "success" ? "Estavel" : deliveryTone === "warning" ? "Atencao" : "Critico"}
              sx={{
                alignSelf: "flex-start",
                backgroundColor: toneColor(deliveryTone),
                color: tokens.colors.text.inverse,
              }}
            />
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Acuracia de roteamento</Typography>
            <Typography variant="h4">{toPercent(props.indicators.routingAccuracy)}</Typography>
            <Chip
              label={accuracyTone === "success" ? "Confiavel" : accuracyTone === "warning" ? "Monitorar" : "Risco alto"}
              sx={{
                alignSelf: "flex-start",
                backgroundColor: toneColor(accuracyTone),
                color: tokens.colors.text.inverse,
              }}
            />
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Pendencias operacionais</Typography>
            <Typography variant="h4">{props.indicators.pendingCount}</Typography>
            <Chip
              label={pendingTone === "success" ? "Sem pendencias" : pendingTone === "warning" ? "Atencao" : "Escalar"}
              sx={{
                alignSelf: "flex-start",
                backgroundColor: toneColor(pendingTone),
                color: tokens.colors.text.inverse,
              }}
            />
          </Stack>
        </Paper>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Typography variant="h6">Resumo do recorte</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Lotes no recorte: <strong>{props.indicators.totals.totalBatches}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lotes publicados: <strong>{props.indicators.totals.publishedBatches}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Itens roteados: <strong>{props.indicators.totals.routingMatchedItems}</strong> / {props.indicators.totals.routingTotalItems}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}