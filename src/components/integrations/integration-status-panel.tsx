import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
import { StatusTimeline } from "@/components/audit/status-timeline";
import { tokens } from "@/lib/theme/tokens";
import type { ExternalIngestion } from "@/modules/integrations/domain/external-ingestion";

function statusLabel(status: ExternalIngestion["status"]): string {
  if (status === "received") {
    return "Recebido";
  }

  if (status === "processing") {
    return "Em processamento";
  }

  if (status === "processed") {
    return "Processado";
  }

  return "Falha";
}

function toneForStatus(status: ExternalIngestion["status"]): "info" | "warning" | "success" | "error" {
  if (status === "received") {
    return "info";
  }

  if (status === "processing") {
    return "warning";
  }

  if (status === "processed") {
    return "success";
  }

  return "error";
}

export function IntegrationStatusPanel(props: {
  ingestions?: ExternalIngestion[];
  selectedIngestion?: ExternalIngestion | null;
  metadata?: {
    total: number;
    received_count: number;
    processing_count: number;
    processed_count: number;
    failed_count: number;
  };
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const ingestions = props.ingestions ?? [];
  const selectedIngestion = props.selectedIngestion ?? ingestions[0] ?? null;
  const metadata =
    props.metadata ??
    ({ total: 0, received_count: 0, processing_count: 0, processed_count: 0, failed_count: 0 } as const);

  if (props.isLoading) {
    return <Alert severity="info">Carregando integracoes externas...</Alert>;
  }

  if (props.errorMessage) {
    return <Alert severity="error">{props.errorMessage}</Alert>;
  }

  if (ingestions.length === 0) {
    return <Alert severity="info">Nenhuma ingestao externa encontrada para os filtros atuais.</Alert>;
  }

  return (
    <Stack spacing={2} component="section" aria-label="Painel de integracoes externas" aria-live="polite">
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2" id="integration-panel-heading">
            Status de integracoes externas
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip label={`Total: ${metadata.total}`} variant="outlined" />
            <Chip label={`Recebidos: ${metadata.received_count}`} variant="outlined" />
            <Chip label={`Em processamento: ${metadata.processing_count}`} variant="outlined" />
            <Chip label={`Processados: ${metadata.processed_count}`} variant="outlined" />
            <Chip label={`Falhas: ${metadata.failed_count}`} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Stack component="ul" spacing={2} sx={{ listStyle: "none", p: 0, m: 0 }} aria-labelledby="integration-panel-heading">
        {ingestions.map((ingestion) => (
          <Paper
            component="li"
            key={ingestion.ingestion_id}
            elevation={0}
            tabIndex={0}
            aria-label={`Ingestao ${statusLabel(ingestion.status)} da origem ${ingestion.source_system}`}
            sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}
          >
            <Stack spacing={1.25}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip
                  label={`Status: ${statusLabel(ingestion.status)}`}
                  color={toneForStatus(ingestion.status)}
                  variant="filled"
                />
                <Chip label={`Origem: ${ingestion.source_system}`} variant="outlined" />
                <Chip label={`Tenant: ${ingestion.tenant_id}`} variant="outlined" />
                <Chip label={`Referencia: ${ingestion.source_reference}`} variant="outlined" />
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Ingestion ID: {ingestion.ingestion_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chave de idempotencia: {ingestion.idempotency_key}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recomendacao: {ingestion.resolution.recommended_action ?? "Monitorar o status do processamento."}
              </Typography>

              {selectedIngestion?.ingestion_id === ingestion.ingestion_id ? (
                <Paper elevation={0} sx={{ p: 1.5, backgroundColor: tokens.colors.surface.subtle ?? "#f7fafc" }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Detalhe selecionado
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">Recebido em: {new Date(ingestion.received_at).toLocaleString("pt-BR")}</Typography>
                    <Typography variant="body2">
                      Processamento iniciado: {ingestion.processing_started_at ?? "Ainda nao iniciado"}
                    </Typography>
                    <Typography variant="body2">
                      Processado em: {ingestion.processed_at ?? "Nao processado"}
                    </Typography>
                    <Typography variant="body2">
                      Falha em: {ingestion.failed_at ?? "Sem falha"}
                    </Typography>
                  </Stack>
                </Paper>
              ) : null}

              <StatusTimeline items={ingestion.timeline} />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
