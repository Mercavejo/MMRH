import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { exceptionCorrectionResults } from "@/modules/exceptions/domain/exception";

export function ExceptionActionForm(props: {
  actionDescription: string;
  expectedResult: (typeof exceptionCorrectionResults)[number];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onActionDescriptionChange: (value: string) => void;
  onExpectedResultChange: (value: (typeof exceptionCorrectionResults)[number]) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <Stack spacing={2} component="section" aria-label="Formulario de acao corretiva">
      <Typography variant="h6">Registrar acao corretiva</Typography>
      <TextField
        label="Descricao da correcao"
        value={props.actionDescription}
        onChange={(event) => props.onActionDescriptionChange(event.target.value)}
        multiline
        minRows={4}
        fullWidth
        required
        slotProps={{
          htmlInput: {
            minLength: 10,
            "aria-describedby": "exception-action-help",
          },
        }}
        helperText="Explique de forma objetiva o que foi verificado ou corrigido."
      />
      <TextField
        label="Resultado esperado"
        value={props.expectedResult}
        onChange={(event) => props.onExpectedResultChange(event.target.value as (typeof exceptionCorrectionResults)[number])}
        select
        fullWidth
      >
        {exceptionCorrectionResults.map((result) => (
          <MenuItem key={result} value={result}>
            {result}
          </MenuItem>
        ))}
      </TextField>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" onClick={props.onSubmit} disabled={props.isSubmitting}>
          {props.isSubmitting ? "Registrando..." : "Salvar acao"}
        </Button>
        <Button variant="outlined" onClick={props.onCancel} disabled={props.isSubmitting}>
          Cancelar
        </Button>
      </Stack>

      {props.successMessage ? <Alert severity="success">{props.successMessage}</Alert> : null}
      {props.errorMessage ? <Alert severity="error">{props.errorMessage}</Alert> : null}
      <Typography id="exception-action-help" variant="body2" color="text.secondary">
        O registro gera trilha de auditoria com autor e horario.
      </Typography>
    </Stack>
  );
}