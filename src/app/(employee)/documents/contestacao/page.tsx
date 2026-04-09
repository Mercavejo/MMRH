"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type ApiResponse<T> = {
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
};

function getGuidanceByStatus(status: string) {
  if (status === "pending") {
    return "Status pendente: o RH recebera sua solicitacao com contexto de periodo e tipo para acompanhar a publicacao.";
  }

  if (status === "error") {
    return "Status de erro: a solicitacao sera priorizada para identificar a falha operacional do documento.";
  }

  return "Status indisponivel: a solicitacao ajudara o RH a rastrear lote e causa de ausencia do documento.";
}

export default function EmployeeDocumentContestationPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const documentId = searchParams.get("document_id") ?? "";
  const periodRef = searchParams.get("period_ref") ?? "";
  const documentType = searchParams.get("document_type") ?? "";
  const status = searchParams.get("status") ?? "unavailable";

  const [reason, setReason] = useState(
    "Documento esperado nao esta disponivel no portal. Solicito verificacao contextual.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const backHref = from ? `/documents?${from}` : "/documents";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/v1/employee/documents/contestations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: documentId,
          reason,
        }),
      });

      const body = (await response.json()) as ApiResponse<{
        contestation_id: string;
      }>;

      if (!response.ok || body.error) {
        setErrorMessage(body.error?.message ?? "Falha ao abrir contestacao.");
        return;
      }

      setSuccessMessage(
        `Contestacao aberta com sucesso. Protocolo: ${body.data?.contestation_id}.`,
      );
    } catch {
      setErrorMessage("Falha de rede ao abrir contestacao. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h2">Abrir Contestacao de Documento</Typography>

          <Alert severity="info" role="status">
            {getGuidanceByStatus(status)}
          </Alert>

          {errorMessage ? (
            <Alert severity="error" role="alert">
              {errorMessage}
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert severity="success" role="status">
              {successMessage}
            </Alert>
          ) : null}

          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            <TextField
              label="Documento"
              value={documentId}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Periodo"
              value={periodRef}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Tipo de documento"
              value={documentType}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Status atual"
              value={status}
              slotProps={{ input: { readOnly: true } }}
            />
            <TextField
              label="Motivo da contestacao"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              multiline
              minRows={3}
              required
            />

            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "Enviar contestacao"}
            </Button>

            <Button component={Link} href={backHref} variant="outlined">
              Voltar para lista
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
