import { CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";

export default function LoadingEmployeeDocumentsPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack
          spacing={2}
          aria-live="polite"
          sx={{ display: "flex", alignItems: "center" }}
        >
          <CircularProgress size={28} />
          <Typography variant="body1">Carregando documentos...</Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
