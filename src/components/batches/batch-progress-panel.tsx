"use client";

import { useEffect, useCallback } from "react";
import { Button, Chip, Container, LinearProgress, Paper, Stack, Typography, Alert, Box, alpha } from "@mui/material";
import RoutingIcon from "@mui/icons-material/AltRoute";
import SuccessIcon from "@mui/icons-material/CheckCircle";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  buildEmptyBatchRoutingProgress,
  type BatchRoutingProgress,
} from "@/lib/rh/batches/batch-progress";
import { BatchStepper } from "./batch-stepper";

export function BatchProgressPanel(props: {
  summary?: BatchRoutingProgress | null;
  statusMessage?: string;
  statusTone?: "info" | "success" | "warning" | "error";
  isProcessing?: boolean;
  onProcess?: () => void | Promise<void>;
  onReprocess?: () => void | Promise<void>;
  isReprocessing?: boolean;
  onPublish?: () => void | Promise<void>;
  isPublishing?: boolean;
}) {
  const summary = props.summary ?? buildEmptyBatchRoutingProgress();
  
  const triggerConfetti = useCallback(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  }, []);

  useEffect(() => {
    if (summary.publication_status === "published") {
      triggerConfetti();
    }
  }, [summary.publication_status, triggerConfetti]);

  const processedDocuments =
    summary.matched_documents + summary.failed_documents + summary.ambiguous_documents;
  
  const progressValue =
    summary.total_documents === 0
      ? 0
      : Math.min(100, Math.round((processedDocuments / summary.total_documents) * 100));

  const canStartRouting = Boolean(props.onProcess) && summary.batch_id.length > 0 && summary.routing_status === "pending";
  const canStartReprocess =
    Boolean(props.onReprocess) &&
    summary.batch_id.length > 0 &&
    (summary.routing_status === "blocked" || summary.routing_status === "failed" || summary.routing_status === "completed");
  const canStartPublish =
    Boolean(props.onPublish) &&
    summary.batch_id.length > 0 &&
    summary.routing_status === "completed" &&
    summary.publication_status !== "publishing" &&
    summary.publication_status !== "published";
  const isPublished = summary.publication_status === "published";
  const publishedAt = summary.published_at ? new Date(summary.published_at) : null;
  const processedAt = summary.processed_at ? new Date(summary.processed_at) : null;
  const totalPublished = summary.matched_documents;
  const blockedGuidance =
    summary.blocked_documents === 1
      ? "Revise o documento bloqueado por ambiguidade antes de reprocessar."
      : "Revise os documentos bloqueados por ambiguidade antes de reprocessar.";
  const totalTimeLabel =
    publishedAt && processedAt
      ? `${Math.max(0, Math.round((publishedAt.getTime() - processedAt.getTime()) / 1000))}s`
      : "Nao disponivel";

  return (
    <Container maxWidth="lg" sx={{ pb: 4 }}>
      <Paper 
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        sx={{ p: 4, borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}
      >
        <Stack spacing={4}>
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 2, fontWeight: 700, color: "primary.main" }}>
              Operacao RH / Monitoramento de Lote
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {summary.batch_id ? `Lote #${summary.batch_id.slice(-6).toUpperCase()}` : "Aguardando Importacao"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {summary.batch_id
                ? "Acompanhe o fluxo de roteamento e publique os documentos validados no portal."
                : "Selecione e valide um relatorio para iniciar o processo de publicacao."}
            </Typography>
          </Stack>

          <BatchStepper summary={summary} />

          <Stack spacing={1}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {props.isProcessing ? "Roteando documentos..." : "Progresso da Etapa"}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>
                {progressValue}%
              </Typography>
            </Box>
            <LinearProgress
              variant={props.isProcessing ? "indeterminate" : "determinate"}
              value={progressValue}
              sx={{ 
                height: 12, 
                borderRadius: 999,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 999,
                  transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)"
                }
              }}
            />
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <AnimatePresence>
              {[
                { label: "Total", value: summary.total_documents, color: "default" as const },
                { label: "Sucesso", value: summary.matched_documents, color: "success" as const },
                { label: "Pendente", value: summary.pending_documents, color: "info" as const },
                { label: "Ambiguidade", value: summary.ambiguous_documents, color: "warning" as const },
                { label: "Falha", value: summary.failed_documents, color: "error" as const },
              ].map((stat) => (
                <Chip
                  key={stat.label}
                  component={motion.div}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  label={`${stat.label}: ${stat.value}`}
                  color={stat.color}
                  variant="outlined"
                  sx={{ fontWeight: 600, borderWidth: 2 }}
                />
              ))}
            </AnimatePresence>
          </Stack>

          <AnimatePresence mode="wait">
            {props.statusMessage && (
              <motion.div
                key={props.statusMessage}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Alert 
                  severity={props.statusTone ?? "info"}
                  variant="filled"
                  sx={{ borderRadius: 2 }}
                >
                  {props.statusMessage}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {summary.routing_status === "blocked" && summary.blocked_reason ? (
            <Alert severity="warning" variant="outlined">
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {blockedGuidance}
                </Typography>
                <Typography variant="body2">{summary.blocked_reason}</Typography>
              </Stack>
            </Alert>
          ) : null}

          {isPublished ? (
            <Paper
              component={motion.div}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              variant="outlined"
              sx={{
                p: 3,
                borderColor: "success.main",
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <SuccessIcon color="success" />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Lote publicado com sucesso
                  </Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip label={`Documentos publicados: ${totalPublished}`} color="success" />
                  <Chip label={`Tempo total: ${totalTimeLabel}`} variant="outlined" />
                  <Chip label={`Lote: ${summary.batch_id.slice(-6).toUpperCase()}`} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Consulte o historico do lote em "Processamento de Lotes" ou abra um chamado tecnico se precisar de apoio da Mercavejo.
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              size="large"
              onClick={props.onProcess}
              disabled={!canStartRouting || props.isProcessing}
              startIcon={<RoutingIcon />}
              sx={{ borderRadius: 2, px: 4, py: 1.5, fontWeight: 700 }}
            >
              {props.isProcessing ? "Processando..." : "Iniciar Roteamento"}
            </Button>

            <Button
              variant="outlined"
              size="large"
              onClick={props.onReprocess}
              disabled={!canStartReprocess || props.isReprocessing}
              sx={{ borderRadius: 2, px: 4, py: 1.5, fontWeight: 700 }}
            >
              {props.isReprocessing ? "Reprocessando..." : "Reprocessar Itens"}
            </Button>

            <Button
              variant="contained"
              size="large"
              color="primary"
              onClick={props.onPublish}
              disabled={!canStartPublish || props.isPublishing}
              sx={{ 
                borderRadius: 2, 
                px: 6, 
                py: 1.5, 
                fontWeight: 800,
                boxShadow: (theme) => `0 8px 16px ${alpha(theme.palette.primary.main, 0.3)}`
              }}
            >
              {props.isPublishing ? "Publicando..." : "Publicar Lote"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
