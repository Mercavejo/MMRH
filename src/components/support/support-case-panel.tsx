"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Box,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  NativeSelect,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { StatusTimeline } from "@/components/audit/status-timeline";
import { tokens } from "@/lib/theme/tokens";
import type { SupportCase } from "@/modules/support/domain/support-case";

function statusLabel(status: SupportCase["status"]): string {
  if (status === "open") {
    return "Aberto";
  }

  if (status === "in_treatment") {
    return "Em tratamento";
  }

  return "Resolvido";
}

export function SupportCasePanel(props: {
  supportCase: SupportCase | null;
  errorMessage?: string | null;
  isLoading?: boolean;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (props.errorMessage) {
    return <Alert severity="error">{props.errorMessage}</Alert>;
  }

  if (props.isLoading) {
    return <Alert severity="info">Carregando caso de suporte...</Alert>;
  }

  if (!props.supportCase) {
    return <Alert severity="info">Nenhum caso de suporte selecionado.</Alert>;
  }

  const { supportCase } = props;

  return (
    <Stack spacing={2} component="section" aria-label="Caso de suporte consolidado">
      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Stack spacing={1}>
          <Typography variant="h6" component="h2">
            Caso de suporte
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip label={`Case: ${supportCase.case_id}`} variant="outlined" />
            <Chip label={`Status: ${statusLabel(supportCase.status)}`} variant="outlined" />
            <Chip label={`Severidade: ${supportCase.severity}`} variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Vinculos: lote {supportCase.links.batch_id ?? "-"} · documento {supportCase.links.document_id ?? "-"} · usuario {supportCase.links.user_id ?? "-"}
          </Typography>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Typography variant="subtitle1" component="h3" gutterBottom>
          Historico funcional
        </Typography>
        {supportCase.functional_history.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Sem eventos funcionais para o caso.</Typography>
        ) : (
          <Stack spacing={1} component="ol" sx={{ listStyle: "none", p: 0, m: 0 }}>
            {supportCase.functional_history.map((item, index) => (
              <Box 
                component="li"
                key={`${item.source}-${item.occurred_at}-${index}`}
                sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(15, 23, 42, 0.02)',
                  borderLeft: `3px solid ${
                    item.status === 'success' ? tokens.colors.success : 
                    (item.status === 'error' || item.status === 'failed') ? tokens.colors.danger : 
                    tokens.colors.processing
                  }`
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.source}</Typography>
                <Typography variant="body2" color="text.secondary">{item.message}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <StatusTimeline items={supportCase.timeline} />

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Typography variant="subtitle1" component="h3" gutterBottom>
          Formulario de resolucao
        </Typography>
        {submitError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        ) : null}
        <form 
          method="post" 
          action={`/api/v1/support/cases/${supportCase.case_id}/resolve`}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setSubmitError(null);
            setIsSubmitting(true);

            try {
              const response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
              if (!response.ok) {
                const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
                setSubmitError(body?.error?.message ?? "Falha ao registrar resolução.");
                return;
              }

              window.location.reload();
            } catch {
              setSubmitError("Falha de rede ao registrar resolução.");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth
                label="Código da Causa"
                id="support-cause-code" 
                name="cause_code" 
                required 
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField 
                fullWidth
                label="Ação Aplicada"
                id="support-action-applied" 
                name="action_applied" 
                required 
                variant="outlined"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel htmlFor="support-result-status">
                  Resultado
                </InputLabel>
                <NativeSelect
                  id="support-result-status"
                  name="result_status"
                  defaultValue="resolved"
                  aria-label="Resultado"
                >
                  <option value="resolved">Resolvido (Success)</option>
                  <option value="partial">Parcial (Warning)</option>
                  <option value="failed">Falha (Error)</option>
                </NativeSelect>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                fullWidth
                disabled={isSubmitting}
                sx={{ borderRadius: 2 }}
              >
                {isSubmitting ? "Registrando..." : "Registrar Resolução"}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {supportCase.resolution ? (
        <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Typography variant="subtitle1" component="h3" gutterBottom>
            Evidencia de resolucao
          </Typography>
          <Typography variant="body2">Causa: {supportCase.resolution.cause_code}</Typography>
          <Typography variant="body2">Acao: {supportCase.resolution.action_applied}</Typography>
          <Typography variant="body2">Resultado: {supportCase.resolution.result_status}</Typography>
          <Typography variant="caption" color="text.secondary">
            Resolvido por {supportCase.resolution.resolved_by} em {new Date(supportCase.resolution.resolved_at).toLocaleString("pt-BR")}
          </Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
