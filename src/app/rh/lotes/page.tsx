"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DropZone } from "@/components/batches/drop-zone";
import { BatchProgressPanel } from "@/components/batches/batch-progress-panel";
import type { BatchImportValidationSummary } from "@/lib/rh/batches/import-validation";
import {
  buildPendingBatchRoutingProgress,
  type BatchRoutingProgress,
} from "@/lib/rh/batches/batch-progress";

type BatchImportFeedback =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; message: string; batchId: string; summary: BatchImportValidationSummary }
  | { state: "error"; message: string; issues?: Array<Record<string, unknown>> };

type RoutingNotice = {
  tone: "info" | "success" | "warning" | "error";
  message: string;
} | null;

export function buildBatchImportFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function BatchImportPageView(props: {
  selectedFile: File | null;
  feedback: BatchImportFeedback;
  isSubmitDisabled: boolean;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { selectedFile, feedback, isSubmitDisabled, onFileChange, onSubmit } = props;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1.8 }}>
            Operacao RH / Lotes
          </Typography>
          <Typography variant="h2">Importacao de relatorio e validacao inicial</Typography>
          <Typography variant="body1" color="text.secondary">
            Envie o relatorio geral em CSV, JSON ou PDF. O sistema valida schema, obrigatoriedade e consistencia antes de qualquer processamento.
          </Typography>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
            <Stack spacing={1}>
              <Typography variant="h6">Arquivo do lote</Typography>
              <Typography variant="body2" color="text.secondary">
                Colunas obrigatorias: employee_identifier, document_type e period_ref.
              </Typography>
            </Stack>

            <DropZone 
              onFileSelect={onFileChange}
              selectedFile={selectedFile}
              isSubmitting={feedback.state === "submitting"}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button type="submit" variant="contained" disabled={isSubmitDisabled}>
                {feedback.state === "submitting" ? "Validando lote..." : "Validar e importar"}
              </Button>
              <Chip label="Uma acao principal por tela" variant="outlined" />
            </Stack>

            {feedback.state === "submitting" ? (
              <Alert severity="info" role="status">
                Validacao em andamento. O sistema esta conferindo estrutura e consistencia minima do relatorio.
              </Alert>
            ) : null}

            {feedback.state === "success" ? (
              <Alert severity="success" role="status">
                {feedback.message}
                <Box component="span" sx={{ display: "block", mt: 1 }}>
                  Lote {feedback.batchId} validado com {feedback.summary.valid_rows} linha(s) aceitas.
                </Box>
              </Alert>
            ) : null}

            {feedback.state === "error" ? (
              <Alert severity="error" role="alert">
                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {feedback.message}
                  </Typography>

                  {feedback.issues?.length ? (
                    <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
                      {feedback.issues.map((issue, index) => {
                        const code = typeof issue.code === "string" ? issue.code : null;
                        const message = typeof issue.message === "string" ? issue.message : null;
                        const row = typeof issue.row === "number" ? `Linha ${issue.row}` : null;
                        const column = typeof issue.column === "string" ? `Coluna ${issue.column}` : null;

                        return (
                          <Typography component="li" variant="body2" key={`${code ?? "issue"}-${index}`}>
                            {[code, message, row, column].filter(Boolean).join(" - ")}
                          </Typography>
                        );
                      })}
                    </Stack>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default function RhBatchImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<BatchImportFeedback>({ state: "idle" });
  const [routingProgress, setRoutingProgress] = useState<BatchRoutingProgress | null>(null);
  const [routingNotice, setRoutingNotice] = useState<RoutingNotice>(null);
  const [routingInProgress, setRoutingInProgress] = useState(false);
  const [reprocessInProgress, setReprocessInProgress] = useState(false);
  const [publishingInProgress, setPublishingInProgress] = useState(false);
  const publishIdempotencyKeyRef = useRef<string | null>(null);
  const publishBatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentBatchId = routingProgress?.batch_id ?? null;

    if (publishBatchIdRef.current !== currentBatchId) {
      publishBatchIdRef.current = currentBatchId;
      publishIdempotencyKeyRef.current = null;
    }
  }, [routingProgress?.batch_id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setFeedback({
        state: "error",
        message: "Selecione um arquivo antes de validar o lote.",
      });
      return;
    }

    setFeedback({ state: "submitting" });

    const idempotencyKey = crypto.randomUUID();
    const formData = buildBatchImportFormData(selectedFile);
    formData.append("idempotency_key", idempotencyKey);

    const response = await fetch("/api/v1/rh/batches", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as {
      data: {
        batch_id: string;
        validation_status: "validated" | "blocked";
        validation_summary: BatchImportValidationSummary;
        original_filename: string;
      } | null;
      error: { message: string; details?: { summary?: BatchImportValidationSummary } } | null;
      meta: {
        correlation_id: string;
        timestamp?: string;
        tenant_id?: string;
      };
    };

    if (!response.ok || !payload.data) {
      setRoutingProgress(null);
      const validationIssues = payload.error?.details?.summary?.issues ?? [];
      setRoutingNotice({
        tone: "error",
        message: payload.error?.message ?? "Nao foi possivel validar o lote.",
      });
      setFeedback({
        state: "error",
        message: payload.error?.message ?? "Nao foi possivel validar o lote.",
        issues: validationIssues,
      });
      return;
    }

    setRoutingProgress(
      buildPendingBatchRoutingProgress({
        batchId: payload.data.batch_id,
        tenantId: payload.meta.tenant_id ?? "",
        totalDocuments: payload.data.validation_summary.total_rows,
      }),
    );
    setRoutingNotice({
      tone: "info",
      message:
        "Lote validado. Inicie o roteamento para bloquear ambiguidades antes da publicacao.",
    });

    setFeedback({
      state: "success",
      message: `Lote ${payload.data.original_filename} validado com sucesso.`,
      batchId: payload.data.batch_id,
      summary: payload.data.validation_summary,
    });
  }

  async function handleProcessRouting() {
    if (!routingProgress?.batch_id || routingInProgress) {
      return;
    }

    setRoutingInProgress(true);
    setRoutingNotice({
      tone: "info",
      message: "Roteamento em andamento. O sistema esta bloqueando ambiguidades antes da publicacao.",
    });

    const response = await fetch(`/api/v1/rh/batches/${routingProgress.batch_id}/process`, {
      method: "POST",
    });

    const payload = (await response.json()) as {
      data: BatchRoutingProgress | null;
      error: { message: string } | null;
    };

    if (!response.ok || !payload.data) {
      setRoutingNotice({
        tone: "error",
        message: payload.error?.message ?? "Nao foi possivel executar o roteamento.",
      });
      setRoutingInProgress(false);
      return;
    }

    setRoutingProgress(payload.data);
    setRoutingNotice({
      tone: payload.data.routing_status === "blocked" ? "warning" : "success",
      message:
        payload.data.routing_status === "blocked"
          ? "Roteamento concluido com bloqueios por ambiguidade."
          : "Roteamento concluido com sucesso.",
    });
    setRoutingInProgress(false);
  }

  async function handleReprocessEligible() {
    if (!routingProgress?.batch_id || reprocessInProgress) {
      return;
    }

    setReprocessInProgress(true);
    setRoutingNotice({
      tone: "info",
      message: "Reprocessamento seletivo em andamento para itens elegiveis.",
    });

    const response = await fetch(`/api/v1/rh/batches/${routingProgress.batch_id}/reprocess`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reprocess_all_eligible: true,
        idempotency_key: crypto.randomUUID(),
      }),
    });

    const payload = (await response.json()) as {
      data: {
        total_reprocessed: number;
        total_remaining: number;
      } | null;
      error: { message: string } | null;
    };

    if (!response.ok || !payload.data) {
      setRoutingNotice({
        tone: "error",
        message: payload.error?.message ?? "Nao foi possivel executar o reprocessamento seletivo.",
      });
      setReprocessInProgress(false);
      return;
    }

    setRoutingNotice({
      tone: payload.data.total_reprocessed > 0 ? "success" : "warning",
      message:
        payload.data.total_reprocessed > 0
          ? `Reprocessamento concluido com ${payload.data.total_reprocessed} item(ns) resolvido(s).`
          : `Nenhum item elegivel foi reprocessado. Restantes: ${payload.data.total_remaining}.`,
    });
    setReprocessInProgress(false);
  }

  async function handlePublishBatch() {
    if (!routingProgress?.batch_id || publishingInProgress) {
      return;
    }

    const idempotencyKey = publishIdempotencyKeyRef.current ?? crypto.randomUUID();
    publishIdempotencyKeyRef.current = idempotencyKey;
    setPublishingInProgress(true);
    setRoutingNotice({
      tone: "info",
      message: "Publicacao em andamento. O sistema esta liberando o lote validado no portal.",
    });

    try {
      const response = await fetch(`/api/v1/rh/batches/${routingProgress.batch_id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
        }),
      });

      const payload = (await response.json()) as {
        data: (BatchRoutingProgress & {
          total_requested: number;
          total_published: number;
          total_skipped: number;
          total_failed: number;
        }) | null;
        error: { message: string } | null;
      };

      if (!response.ok || !payload.data) {
        setRoutingNotice({
          tone: "error",
          message: payload.error?.message ?? "Nao foi possivel publicar o lote.",
        });
        return;
      }

      setRoutingProgress(payload.data);
      setRoutingNotice({
        tone: "success",
        message:
          payload.data.total_published > 0
            ? `Lote publicado com ${payload.data.total_published} documento(s).`
            : "Lote publicado com sucesso.",
      });
    } catch {
      setRoutingNotice({
        tone: "error",
        message: "Falha de comunicacao ao publicar o lote. Tente novamente.",
      });
    } finally {
      setPublishingInProgress(false);
    }
  }

  return (
    <Stack spacing={3}>
      <BatchImportPageView
        selectedFile={selectedFile}
        feedback={feedback}
        isSubmitDisabled={feedback.state === "submitting"}
        onFileChange={setSelectedFile}
        onSubmit={handleSubmit}
      />

      <BatchProgressPanel
        summary={routingProgress}
        isProcessing={routingInProgress}
        isReprocessing={reprocessInProgress}
        isPublishing={publishingInProgress}
        statusTone={routingNotice?.tone ?? undefined}
        statusMessage={routingNotice?.message ?? undefined}
        onProcess={handleProcessRouting}
        onReprocess={handleReprocessEligible}
        onPublish={handlePublishBatch}
      />
    </Stack>
  );
}
