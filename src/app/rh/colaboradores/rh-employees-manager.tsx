"use client";

import { startTransition, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { EmployeeIdentityListItem } from "@/modules/employee-identity/application/types";

type FormState = {
  employee_name: string;
  reference_code: string;
  admission_date: string;
  status: "pending_activation" | "active" | "blocked" | "inactive";
  notes: string;
};

const initialFormState: FormState = {
  employee_name: "",
  reference_code: "",
  admission_date: "",
  status: "pending_activation",
  notes: "",
};

export function shouldShowEditableEmployeeStatus(editingEmployeeId: string | null) {
  return Boolean(editingEmployeeId);
}

export function RhEmployeesManager({
  initialItems,
}: {
  initialItems: EmployeeIdentityListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeIdentityListItem | null>(null);

  function resetEditor() {
    setEditingEmployeeId(null);
    setForm(initialFormState);
  }

  function loadEmployee(item: EmployeeIdentityListItem) {
    setEditingEmployeeId(item.employee_id);
    setForm({
      employee_name: item.employee_name,
      reference_code: item.reference_code,
      admission_date: item.admission_date,
      status: item.status,
      notes: item.notes ?? "",
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function onSubmit() {
    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const url = editingEmployeeId
        ? `/api/v1/rh/employees/${editingEmployeeId}`
        : "/api/v1/rh/employees";
      const method = editingEmployeeId ? "PATCH" : "POST";

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(form),
        });

        const body = await response.json();
        if (!response.ok) {
          setErrorMessage(body?.error?.message ?? "Falha operacional ao salvar colaborador.");
          setIsPending(false);
          return;
        }

        const nextItem = body.data as EmployeeIdentityListItem;
        setItems((current) => {
          if (editingEmployeeId) {
            return current.map((item) => (item.employee_id === nextItem.employee_id ? nextItem : item));
          }

          return [nextItem, ...current];
        });
        setSuccessMessage(
          editingEmployeeId
            ? "Colaborador atualizado com sucesso."
            : "Colaborador cadastrado com status pendente de ativacao.",
        );
        resetEditor();
      } catch {
        setErrorMessage("Falha operacional ao salvar colaborador.");
      } finally {
        setIsPending(false);
      }
    });
  }

  function handleDelete(item: EmployeeIdentityListItem) {
    setDeletingEmployee(item);
  }

  function confirmDelete() {
    if (!deletingEmployee) return;
    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/v1/rh/employees/${deletingEmployee.employee_id}`, {
          method: "DELETE",
        });

        const body = await response.json();
        if (!response.ok) {
          setErrorMessage(body?.error?.message ?? "Falha ao remover colaborador.");
          setIsPending(false);
          setDeletingEmployee(null);
          return;
        }

        setItems((current) => current.filter((item) => item.employee_id !== deletingEmployee.employee_id));
        setSuccessMessage("Colaborador removido com sucesso.");
        setDeletingEmployee(null);
      } catch {
        setErrorMessage("Falha ao remover colaborador.");
      } finally {
        setIsPending(false);
      }
    });
  }

  return (
    <Stack spacing={3}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">
            {editingEmployeeId ? "Atualizar cadastro funcional" : "Novo cadastro funcional"}
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Nome do colaborador"
              value={form.employee_name}
              onChange={(event) => setForm((current) => ({ ...current, employee_name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Codigo de referencia"
              value={form.reference_code}
              onChange={(event) => setForm((current) => ({ ...current, reference_code: event.target.value }))}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Verificador secundario"
              helperText="Use a data de admissao no formato YYYY-MM-DD."
              value={form.admission_date}
              onChange={(event) => setForm((current) => ({ ...current, admission_date: event.target.value }))}
              fullWidth
            />
            {shouldShowEditableEmployeeStatus(editingEmployeeId) ? (
              <TextField
                select
                label="Status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as FormState["status"],
                  }))
                }
                fullWidth
              >
                <MenuItem value="pending_activation">Pendente de ativacao</MenuItem>
                <MenuItem value="active">Ativo</MenuItem>
                <MenuItem value="blocked">Bloqueado</MenuItem>
                <MenuItem value="inactive">Inativo</MenuItem>
              </TextField>
            ) : (
              <Alert severity="info" sx={{ flex: 1 }}>
                Cadastro inicial sempre cria colaborador com status pendente de ativacao.
              </Alert>
            )}
          </Stack>

          <TextField
            label="Notas operacionais"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            multiline
            minRows={2}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button variant="contained" disabled={isPending} onClick={onSubmit}>
              {shouldShowEditableEmployeeStatus(editingEmployeeId) ? "Salvar alteracoes" : "Cadastrar colaborador"}
            </Button>
            {shouldShowEditableEmployeeStatus(editingEmployeeId) ? (
              <Button variant="outlined" disabled={isPending} onClick={resetEditor}>
                Cancelar edicao
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Colaboradores cadastrados</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Codigo de referencia</TableCell>
                <TableCell>Verificador secundario</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Ativacao</TableCell>
                <TableCell align="right">Acao</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.employee_id}>
                  <TableCell>{item.employee_name}</TableCell>
                  <TableCell>{item.reference_code}</TableCell>
                  <TableCell>{item.admission_date}</TableCell>
                  <TableCell>
                    <Chip size="small" label={item.status_label} />
                  </TableCell>
                  <TableCell>{item.user_id ? "Ja ativado" : "Pendente de ativacao"}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                      <Button size="small" onClick={() => loadEmployee(item)}>
                        Editar
                      </Button>
                      <Button size="small" color="error" onClick={() => handleDelete(item)} disabled={item.status === "active"}>
                        Remover
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">
                      Nenhum colaborador funcional cadastrado para este tenant.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Stack>
      </Paper>

      <Dialog open={!!deletingEmployee} onClose={() => setDeletingEmployee(null)}>
        <DialogTitle>Remover colaborador</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deseja realmente remover o colaborador <strong>{deletingEmployee?.employee_name}</strong>?
            Esta acao nao pode ser desfeita. Apenas colaboradores com status ativo nao podem ser removidos.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingEmployee(null)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={isPending}>
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
