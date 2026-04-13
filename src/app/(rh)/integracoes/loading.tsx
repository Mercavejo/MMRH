import { CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";

export default function LoadingRhIntegrationsPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} aria-live="polite" sx={{ alignItems: "center" }}>
          <CircularProgress size={28} />
          <Typography variant="body1">Carregando integracoes externas...</Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
