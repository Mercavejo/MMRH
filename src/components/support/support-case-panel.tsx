import { Alert, Chip, Paper, Stack, Typography } from "@mui/material";
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
          <Typography variant="body2">Sem eventos funcionais para o caso.</Typography>
        ) : (
          <ul>
            {supportCase.functional_history.map((item, index) => (
              <li key={`${item.source}-${item.occurred_at}-${index}`}>
                <strong>{item.source}</strong> · {item.status} · {item.message}
              </li>
            ))}
          </ul>
        )}
      </Paper>

      <StatusTimeline items={supportCase.timeline} />

      <Paper elevation={0} sx={{ p: 2, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Typography variant="subtitle1" component="h3" gutterBottom>
          Formulario de resolucao
        </Typography>
        <form method="post" action={`/api/v1/support/cases/${supportCase.case_id}/resolve`}>
          <Stack spacing={2}>
            <label htmlFor="support-cause-code">
              cause_code
              <input id="support-cause-code" name="cause_code" type="text" required />
            </label>
            <label htmlFor="support-action-applied">
              action_applied
              <input id="support-action-applied" name="action_applied" type="text" required />
            </label>
            <label htmlFor="support-result-status">
              result_status
              <select id="support-result-status" name="result_status" defaultValue="resolved">
                <option value="resolved">resolved</option>
                <option value="partial">partial</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <button type="submit">Registrar resolucao</button>
          </Stack>
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
