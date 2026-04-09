"use client";

import { Button, Chip, Container, LinearProgress, Paper, Stack, Typography, Alert } from "@mui/material";
import {
  buildEmptyBatchRoutingProgress,
  type BatchRoutingProgress,
} from "@/lib/rh/batches/batch-progress";

export function BatchProgressPanel(props: {
  summary?: BatchRoutingProgress | null;
  statusMessage?: string;
  statusTone?: "info" | "success" | "warning" | "error";
  isProcessing?: boolean;
  onProcess?: () => void | Promise<void>;
}) {
  const summary = props.summary ?? buildEmptyBatchRoutingProgress();
  const processedDocuments =
    summary.matched_documents + summary.failed_documents + summary.ambiguous_documents;
  const progressValue =
    summary.total_documents === 0
      ? 0
      : Math.min(100, Math.round((processedDocuments / summary.total_documents) * 100));
  const canStartRouting = Boolean(props.onProcess) && summary.batch_id.length > 0 && summary.routing_status === "pending";

  return (
    <Container maxWidth="lg" sx={{ pb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="overline" sx={{ letterSpacing: 1.8 }}>
              Operacao RH / Progresso do lote
            </Typography>
            <Typography variant="h5">
              {summary.batch_id ? `Lote ${summary.batch_id}` : "Aguardando lote importado"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.batch_id
                ? "Acompanhe os documentos processados, as pendencias e os bloqueios por ambiguidade antes da publicacao."
                : "Importe um relatorio validado para iniciar o acompanhamento do roteamento."}
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip label={`Processados: ${processedDocuments}`} variant="outlined" />
            <Chip label={`Pendentes: ${summary.pending_documents}`} variant="outlined" />
            <Chip label={`Falhas: ${summary.failed_documents}`} variant="outlined" />
            <Chip label={`Ambiguidades: ${summary.ambiguous_documents}`} variant="outlined" />
          </Stack>

          <LinearProgress
            variant={props.isProcessing ? "indeterminate" : "determinate"}
            value={progressValue}
            aria-label="Progresso do lote"
            sx={{ height: 8, borderRadius: 999 }}
          />

          {props.statusMessage ? (
            <Alert severity={props.statusTone ?? "info"} role={props.statusTone === "error" ? "alert" : "status"}>
              {props.statusMessage}
            </Alert>
          ) : null}

          {summary.blocked_reason ? (
            <Alert severity="warning" role="alert">
              {summary.blocked_reason}
            </Alert>
          ) : null}

          {summary.routing_status === "completed" ? (
            <Alert severity="success" role="status">
              Roteamento concluido. O lote pode seguir para a proxima etapa do fluxo.
            </Alert>
          ) : null}

          {summary.routing_status === "blocked" ? (
            <Alert severity="warning" role="alert">
              O lote ficou bloqueado por ambiguidade e nao pode seguir para publicacao ate a revisao.
            </Alert>
          ) : null}

          {summary.routing_status === "failed" ? (
            <Alert severity="error" role="alert">
              O roteamento nao concluiu. Revise o arquivo de entrada e tente novamente.
            </Alert>
          ) : null}

          <Button
            type="button"
            variant="outlined"
            onClick={props.onProcess}
            disabled={!canStartRouting || props.isProcessing}
            sx={{ alignSelf: "flex-start" }}
          >
            {props.isProcessing ? "Processando lote..." : "Iniciar roteamento"}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export default BatchProgressPanel;