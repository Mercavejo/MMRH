import { Button, Divider, Paper, Stack, Typography } from "@mui/material";
import { tokens } from "@/lib/theme/tokens";
import {
  getExceptionErrorCategoryLabel,
  getExceptionPriorityLabel,
  getExceptionStateLabel,
  type ExceptionDetail,
} from "@/modules/exceptions/domain/exception";
import { ExceptionActionForm } from "./ExceptionActionForm";

export function ExceptionDetailPanel(props: {
  exception: ExceptionDetail | null;
  actionDescription: string;
  expectedResult: "reprocessable" | "reject" | "publish-with-evidence";
  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onActionDescriptionChange: (value: string) => void;
  onExpectedResultChange: (value: "reprocessable" | "reject" | "publish-with-evidence") => void;
  onSubmitAction: () => void;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (!props.exception) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Typography variant="body1" color="text.secondary">
          Selecione uma excecao para ver o contexto completo.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.colors.surface.border}` }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between" }}
        >
          <Stack spacing={0.5}>
            <Typography variant="overline" sx={{ letterSpacing: 1.2 }}>
              Detalhe da excecao
            </Typography>
            <Typography variant="h5">{props.exception.document_external_id}</Typography>
            <Typography variant="body2" color="text.secondary">
              {props.exception.batch_name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={props.onPrevious} disabled={!props.onPrevious}>
              Anterior
            </Button>
            <Button variant="outlined" onClick={props.onNext} disabled={!props.onNext}>
              Proxima
            </Button>
            <Button variant="text" onClick={props.onClose}>
              Voltar
            </Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Typography variant="body2">Categoria: {getExceptionErrorCategoryLabel(props.exception.error_category)}</Typography>
          <Typography variant="body2">Prioridade: {getExceptionPriorityLabel(props.exception.priority)}</Typography>
          <Typography variant="body2">Estado: {getExceptionStateLabel(props.exception.current_state)}</Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Acao recomendada: {props.exception.recommended_action ?? "Sem recomendacao registrada."}
        </Typography>

        <Stack spacing={1}>
          <Typography variant="h6">Detalhes de erro</Typography>
          <Typography variant="body2" color="text.secondary">
            {props.exception.error_details ? JSON.stringify(props.exception.error_details) : "Sem detalhes adicionais."}
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="h6">Historico de acoes</Typography>
          {props.exception.actions_history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma acao corretiva registrada.
            </Typography>
          ) : (
            <Stack spacing={1.5} component="ol" sx={{ pl: 2, m: 0 }}>
              {props.exception.actions_history.map((action) => (
                <Typography component="li" variant="body2" key={action.id}>
                  {action.actor_name ?? action.actor_id}: {action.action_description} ({action.expected_result ?? "sem resultado"})
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>

        <Divider />

        <ExceptionActionForm
          actionDescription={props.actionDescription}
          expectedResult={props.expectedResult}
          isSubmitting={props.isSubmitting}
          errorMessage={props.errorMessage}
          successMessage={props.successMessage}
          onActionDescriptionChange={props.onActionDescriptionChange}
          onExpectedResultChange={props.onExpectedResultChange}
          onSubmit={props.onSubmitAction}
          onCancel={props.onClose}
        />
      </Stack>
    </Paper>
  );
}