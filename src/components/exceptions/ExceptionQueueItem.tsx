import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import DoneOutlineOutlinedIcon from "@mui/icons-material/DoneOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { tokens } from "@/lib/theme/tokens";
import {
  getExceptionPriorityLabel,
  getExceptionStateLabel,
  type ExceptionQueueItem,
} from "@/modules/exceptions/domain/exception";

function buildPriorityTone(priority: ExceptionQueueItem["priority"]) {
  if (priority === "high") {
    return { icon: <PriorityHighOutlinedIcon fontSize="small" />, color: tokens.colors.error };
  }

  if (priority === "medium") {
    return { icon: <ReportProblemOutlinedIcon fontSize="small" />, color: tokens.colors.warning };
  }

  return { icon: <DoneOutlineOutlinedIcon fontSize="small" />, color: tokens.colors.success };
}

function buildStateTone(state: ExceptionQueueItem["current_state"]) {
  if (state === "pending") {
    return { icon: <ReportProblemOutlinedIcon fontSize="small" />, color: tokens.colors.pending };
  }

  if (state === "in-treatment") {
    return { icon: <PriorityHighOutlinedIcon fontSize="small" />, color: tokens.colors.processing };
  }

  if (state === "resolved") {
    return { icon: <DoneOutlineOutlinedIcon fontSize="small" />, color: tokens.colors.success };
  }

  return { icon: <LockOutlinedIcon fontSize="small" />, color: tokens.colors.error };
}

export function ExceptionQueueItem(props: {
  item: ExceptionQueueItem;
  onOpen: (exceptionId: string) => void;
  onReprocess?: (exceptionId: string) => void;
}) {
  const priorityTone = buildPriorityTone(props.item.priority);
  const stateTone = buildStateTone(props.item.current_state);

  return (
    <Paper
      component="article"
      elevation={0}
      sx={{
        p: 2,
        border: `1px solid ${tokens.colors.surface.border}`,
        borderRadius: 3,
        background: tokens.colors.surface.card,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <Stack spacing={0.25}>
            <Typography variant="h3" component="h3">
              {props.item.document_external_id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {props.item.batch_name}
            </Typography>
            <Typography variant="body2">
              Colaborador previsto: {props.item.associated_employee_external_id ?? "Nao informado"}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Chip
              icon={priorityTone.icon}
              label={`Prioridade ${getExceptionPriorityLabel(props.item.priority)}`}
              aria-label={`Prioridade ${getExceptionPriorityLabel(props.item.priority)}`}
              sx={{ backgroundColor: priorityTone.color, color: tokens.colors.text.inverse }}
            />
            <Chip
              icon={stateTone.icon}
              label={`Estado ${getExceptionStateLabel(props.item.current_state)}`}
              aria-label={`Estado ${getExceptionStateLabel(props.item.current_state)}`}
              sx={{ backgroundColor: stateTone.color, color: tokens.colors.text.inverse }}
            />
          </Stack>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Acao recomendada: {props.item.recommended_action ?? "Revisar contexto do lote e registrar correcao."}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" onClick={() => props.onOpen(props.item.id)}>
            Abrir detalhe
          </Button>
          {props.onReprocess ? (
            <Button variant="outlined" onClick={() => props.onReprocess?.(props.item.id)}>
              Abrir reprocessamento
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}