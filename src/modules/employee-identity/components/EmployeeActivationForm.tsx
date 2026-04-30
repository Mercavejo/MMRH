"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { tokens } from "@/lib/theme/tokens";

type FormState = {
  tenant_id: string;
  reference_code: string;
  admission_date: string;
  email: string;
  password: string;
};

const initialState: FormState = {
  tenant_id: "",
  reference_code: "",
  admission_date: "",
  email: "",
  password: "",
};

export function EmployeeActivationForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/employee/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "Nao foi possivel concluir seu primeiro acesso.",
        );
      }

      router.push("/documents");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Nao foi possivel concluir seu primeiro acesso.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, md: 4 },
        width: "100%",
        maxWidth: 520,
        background: tokens.colors.surface.glass,
        backdropFilter: tokens.effects.glass,
        border: `1px solid ${tokens.colors.surface.border}`,
        borderRadius: 4,
        boxShadow: tokens.effects.shadow.lg,
      }}
    >
      <Stack spacing={3} component="form" onSubmit={handleSubmit}>
        <Box>
          <Typography variant="h3" sx={{ color: tokens.colors.primary, mb: 1 }}>
            Primeiro acesso
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Confirme seus dados oficiais e crie sua entrada no portal.
          </Typography>
        </Box>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <TextField
          label="Codigo da empresa"
          value={form.tenant_id}
          onChange={(event) =>
            setForm((current) => ({ ...current, tenant_id: event.target.value }))
          }
          required
          disabled={isSubmitting}
          helperText="Peça este codigo ao RH, se necessario."
        />

        <TextField
          label="Codigo de referencia"
          value={form.reference_code}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              reference_code: event.target.value,
            }))
          }
          required
          disabled={isSubmitting}
        />

        <TextField
          label="Data de admissao"
          type="date"
          value={form.admission_date}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              admission_date: event.target.value,
            }))
          }
          required
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="E-mail"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
          required
          disabled={isSubmitting}
        />

        <TextField
          label="Crie sua senha"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
          required
          disabled={isSubmitting}
          helperText="Use pelo menos 8 caracteres."
        />

        <Button type="submit" variant="contained" disabled={isSubmitting}>
          Ativar meu acesso
        </Button>

        <Typography variant="body2" color="text.secondary">
          Se os dados nao baterem, procure o RH para revisar seu cadastro.
        </Typography>
      </Stack>
    </Paper>
  );
}
