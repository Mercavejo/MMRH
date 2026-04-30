import { Alert, Stack, Typography } from "@mui/material";
import { ExceptionQueueItem as ExceptionQueueCard } from "./ExceptionQueueItem";
import type { ExceptionQueueItem } from "@/modules/exceptions/domain/exception";

export function ExceptionQueueList(props: {
  items: ExceptionQueueItem[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onOpen: (exceptionId: string) => void;
  onReprocess?: (exceptionId: string) => void;
}) {
  if (props.isLoading) {
    return <Alert severity="info">Carregando fila de excecoes...</Alert>;
  }

  if (props.errorMessage) {
    return <Alert severity="error">{props.errorMessage}</Alert>;
  }

  if (props.items.length === 0) {
    return <Alert severity="info">Nenhuma excecao encontrada com os filtros atuais.</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {props.items.length} excecao(oes) listada(s)
      </Typography>
      <Stack spacing={2}>
        {props.items.map((item) => (
          <ExceptionQueueCard key={item.id} item={item} onOpen={props.onOpen} onReprocess={props.onReprocess} />
        ))}
      </Stack>
    </Stack>
  );
}