"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Container,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { tokens } from "@/lib/theme/tokens";
import {
  exceptionPriorities,
  exceptionStates,
  type ExceptionCorrectionResult,
  type ExceptionDetail,
  type ExceptionQueueItem,
  type ExceptionQueueMetadata,
} from "@/modules/exceptions/domain/exception";
import { ExceptionDetailPanel } from "./ExceptionDetailPanel";
import { ExceptionQueueList } from "./ExceptionQueueList";

type QueueFilters = {
  batchId: string;
  priority: (typeof exceptionPriorities)[number] | "";
  state: (typeof exceptionStates)[number] | "";
  skip: number;
  take: number;
};

type QueueResponse = {
  exceptions: ExceptionQueueItem[];
  metadata: ExceptionQueueMetadata;
};

async function fetchQueueData(filters: QueueFilters): Promise<QueueResponse> {
  const searchParams = new URLSearchParams();
  if (filters.priority) searchParams.set("priority", filters.priority);
  if (filters.state) searchParams.set("state", filters.state);
  searchParams.set("skip", String(filters.skip));
  searchParams.set("take", String(filters.take));

  const response = await fetch(`/api/v1/batches/${filters.batchId}/exceptions?${searchParams.toString()}`);
  const payload = (await response.json()) as { data: { exceptions: ExceptionQueueItem[]; metadata: ExceptionQueueMetadata } | null; error?: { message?: string } };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Nao foi possivel carregar a fila de excecoes.");
  }

  return payload.data;
}

async function fetchExceptionDetail(exceptionId: string): Promise<ExceptionDetail> {
  const response = await fetch(`/api/v1/exceptions/${exceptionId}`);
  const payload = (await response.json()) as { data: { exception: ExceptionDetail } | null; error?: { message?: string } };

  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Nao foi possivel carregar a excecao.");
  }

  return payload.data.exception;
}

export function ExceptionQueuePageView(props: {
  filters: QueueFilters;
  metadata: ExceptionQueueMetadata | null;
  items: ExceptionQueueItem[];
  isLoading: boolean;
  errorMessage: string | null;
  selectedException: ExceptionDetail | null;
  actionDescription: string;
  expectedResult: ExceptionCorrectionResult;
  actionErrorMessage: string | null;
  actionSuccessMessage: string | null;
  onFiltersChange: (next: Partial<QueueFilters>) => void;
  onSubmitFilters: (event: FormEvent<HTMLFormElement>) => void;
  onOpenException: (exceptionId: string) => void;
  onCloseDetail: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onActionDescriptionChange: (value: string) => void;
  onExpectedResultChange: (value: ExceptionCorrectionResult) => void;
  onSubmitAction: () => void;
  onRetry: () => void;
  onReprocessException: (exceptionId: string) => void;
  reprocessMessage: string | null;
  reprocessTone: "success" | "warning" | "error" | "info" | null;
}) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            border: `1px solid ${tokens.colors.surface.border}`,
            background: `linear-gradient(135deg, ${tokens.colors.surface.card} 0%, #edf4fb 100%)`,
          }}
        >
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
              Operacao RH / Excecoes
            </Typography>
            <Typography variant="h2">Fila de excecoes e acao corretiva</Typography>
            <Typography variant="body1" color="text.secondary">
              Filtre por lote, prioridade e estado. Abra o detalhe para registrar a correcao e avancar o tratamento sem perder contexto.
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack component="form" spacing={2} onSubmit={props.onSubmitFilters} noValidate>
            <Typography variant="h6">Filtros</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Batch ID"
                value={props.filters.batchId}
                onChange={(event) => props.onFiltersChange({ batchId: event.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Prioridade"
                value={props.filters.priority}
                onChange={(event) => props.onFiltersChange({ priority: event.target.value as QueueFilters["priority"] })}
                select
                fullWidth
              >
                <MenuItem value="">Todas</MenuItem>
                {exceptionPriorities.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {priority}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Estado"
                value={props.filters.state}
                onChange={(event) => props.onFiltersChange({ state: event.target.value as QueueFilters["state"] })}
                select
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                {exceptionStates.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Skip"
                type="number"
                value={props.filters.skip}
                onChange={(event) => props.onFiltersChange({ skip: Number(event.target.value) })}
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                label="Take"
                type="number"
                value={props.filters.take}
                onChange={(event) => props.onFiltersChange({ take: Number(event.target.value) })}
                slotProps={{ htmlInput: { min: 1, max: 100 } }}
              />
              <Button type="submit" variant="contained">
                Aplicar filtros
              </Button>
              <Button variant="outlined" onClick={props.onRetry}>
                Recarregar
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {props.metadata ? (
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
              <Typography variant="body2" color="text.secondary">Pendentes</Typography>
              <Typography variant="h4" aria-live="polite">{props.metadata.pending_count}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
              <Typography variant="body2" color="text.secondary">Em tratamento</Typography>
              <Typography variant="h4" aria-live="polite">{props.metadata.in_treatment_count}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
              <Typography variant="body2" color="text.secondary">Resolvidas</Typography>
              <Typography variant="h4" aria-live="polite">{props.metadata.resolved_count}</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, flex: 1, border: `1px solid ${tokens.colors.surface.border}` }}>
              <Typography variant="body2" color="text.secondary">Bloqueadas</Typography>
              <Typography variant="h4" aria-live="polite">{props.metadata.blocked_count}</Typography>
            </Paper>
          </Stack>
        ) : null}

        <ExceptionQueueList
          items={props.items}
          isLoading={props.isLoading}
          errorMessage={props.errorMessage}
          onOpen={props.onOpenException}
          onReprocess={props.onReprocessException}
        />

        {props.reprocessMessage ? (
          <Alert severity={props.reprocessTone ?? "info"} role="status">
            {props.reprocessMessage}
          </Alert>
        ) : null}

        <ExceptionDetailPanel
          exception={props.selectedException}
          actionDescription={props.actionDescription}
          expectedResult={props.expectedResult}
          errorMessage={props.actionErrorMessage}
          successMessage={props.actionSuccessMessage}
          onActionDescriptionChange={props.onActionDescriptionChange}
          onExpectedResultChange={props.onExpectedResultChange}
          onSubmitAction={props.onSubmitAction}
          onClose={props.onCloseDetail}
          onPrevious={props.onPrevious}
          onNext={props.onNext}
        />
      </Stack>
    </Container>
  );
}

export function ExceptionQueuePage(props: { initialBatchId?: string }) {
  const hasInitialData = Boolean((props as { initialItems?: ExceptionQueueItem[] }).initialItems?.length);
  const queueRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const [filters, setFilters] = useState<QueueFilters>({
    batchId: props.initialBatchId ?? "",
    priority: "",
    state: "",
    skip: 0,
    take: 20,
  });
  const [items, setItems] = useState<ExceptionQueueItem[]>((props as { initialItems?: ExceptionQueueItem[] }).initialItems ?? []);
  const [metadata, setMetadata] = useState<ExceptionQueueMetadata | null>(
    (props as { initialMetadata?: ExceptionQueueMetadata | null }).initialMetadata ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    (props as { initialErrorMessage?: string | null }).initialErrorMessage ?? null,
  );
  const [selectedException, setSelectedException] = useState<ExceptionDetail | null>(null);
  const [actionDescription, setActionDescription] = useState("");
  const [expectedResult, setExpectedResult] = useState<ExceptionCorrectionResult>("reprocessable");
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [reprocessMessage, setReprocessMessage] = useState<string | null>(null);
  const [reprocessTone, setReprocessTone] = useState<"success" | "warning" | "error" | "info" | null>(null);

  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.id === selectedException?.id),
    [items, selectedException?.id],
  );

  async function loadQueue(nextFilters = filters) {
    if (!nextFilters.batchId.trim()) {
      setItems([]);
      setMetadata(null);
      setErrorMessage("Informe um batch_id para carregar a fila.");
      return;
    }

    const requestId = queueRequestIdRef.current + 1;
    queueRequestIdRef.current = requestId;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await fetchQueueData(nextFilters);
      if (queueRequestIdRef.current === requestId) {
        setItems(result.exceptions);
        setMetadata(result.metadata);
      }
    } catch (error) {
      if (queueRequestIdRef.current === requestId) {
        setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a fila de excecoes.");
      }
    } finally {
      if (queueRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (filters.batchId.trim() && !hasInitialData) {
      void loadQueue(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOpenException(exceptionId: string) {
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    try {
      const detail = await fetchExceptionDetail(exceptionId);
      if (detailRequestIdRef.current !== requestId) {
        return;
      }

      setSelectedException(detail);
      setActionDescription(detail.correction_applied ?? detail.recommended_action ?? "");
      setExpectedResult(detail.correction_result ?? "reprocessable");
    } catch (error) {
      if (detailRequestIdRef.current === requestId) {
        setSelectedException(null);
        setActionErrorMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o detalhe da excecao.");
      }
    }
  }

  async function handleSubmitAction() {
    if (!selectedException || actionDescription.trim().length < 10) {
      setActionErrorMessage("Descricao precisa ter pelo menos 10 caracteres.");
      return;
    }

    setActionErrorMessage(null);
    setActionSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/exceptions/${selectedException.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_description: actionDescription,
          expected_result: expectedResult,
        }),
      });

      const payload = (await response.json()) as { data: { message: string } | null; error?: { message?: string } };
      if (!response.ok || !payload.data) {
        setActionErrorMessage(payload.error?.message ?? "Nao foi possivel registrar a acao corretiva.");
        return;
      }

      setActionSuccessMessage(payload.data.message);
      await loadQueue(filters);
      await handleOpenException(selectedException.id);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Nao foi possivel registrar a acao corretiva.");
    }
  }

  function handleCloseDetail() {
    setSelectedException(null);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
  }

  async function handleRetry() {
    await loadQueue(filters);
    if (selectedException) {
      await handleOpenException(selectedException.id);
    }
  }

  async function handleReprocessException(exceptionId: string) {
    const batchId = filters.batchId.trim();
    if (!batchId) {
      setReprocessTone("error");
      setReprocessMessage("Informe o batch_id antes de acionar reprocessamento.");
      return;
    }

    setReprocessMessage(null);
    setReprocessTone(null);

    try {
      const response = await fetch(`/api/v1/rh/batches/${batchId}/reprocess`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exception_ids: [exceptionId],
          reprocess_all_eligible: false,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      const payload = (await response.json()) as {
        data: { total_reprocessed: number; total_remaining: number } | null;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        setReprocessTone("error");
        setReprocessMessage(payload.error?.message ?? "Falha ao acionar reprocessamento.");
        return;
      }

      setReprocessTone(payload.data.total_reprocessed > 0 ? "success" : "warning");
      setReprocessMessage(
        payload.data.total_reprocessed > 0
          ? "Item enviado para reprocessamento seletivo com sucesso."
          : `Nenhum item reprocessado. Restantes: ${payload.data.total_remaining}.`,
      );

      await loadQueue(filters);
      if (selectedException?.id === exceptionId) {
        await handleOpenException(exceptionId);
      }
    } catch (error) {
      setReprocessTone("error");
      setReprocessMessage(error instanceof Error ? error.message : "Falha ao acionar reprocessamento.");
    }
  }

  function handlePrevious() {
    if (selectedIndex > 0) {
      void handleOpenException(items[selectedIndex - 1].id);
    }
  }

  function handleNext() {
    if (selectedIndex >= 0 && selectedIndex < items.length - 1) {
      void handleOpenException(items[selectedIndex + 1].id);
    }
  }

  function handleSubmitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadQueue(filters);
  }

  return (
    <ExceptionQueuePageView
      filters={filters}
      metadata={metadata}
      items={items}
      isLoading={isLoading}
      errorMessage={errorMessage}
      selectedException={selectedException}
      actionDescription={actionDescription}
      expectedResult={expectedResult}
      actionErrorMessage={actionErrorMessage}
      actionSuccessMessage={actionSuccessMessage}
      onFiltersChange={(next) => setFilters((current) => ({ ...current, ...next, skip: next.skip ?? current.skip, take: next.take ?? current.take }))}
      onSubmitFilters={handleSubmitFilters}
      onOpenException={(exceptionId) => {
        void handleOpenException(exceptionId);
      }}
      onCloseDetail={handleCloseDetail}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onActionDescriptionChange={setActionDescription}
      onExpectedResultChange={setExpectedResult}
      onSubmitAction={() => {
        void handleSubmitAction();
      }}
      onRetry={() => {
        void handleRetry();
      }}
      onReprocessException={(exceptionId) => {
        void handleReprocessException(exceptionId);
      }}
      reprocessMessage={reprocessMessage}
      reprocessTone={reprocessTone}
    />
  );
}

export default ExceptionQueuePage;