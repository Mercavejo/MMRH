import { Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { tokens } from "@/lib/theme/tokens";

export default function Home() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 4, border: `1px solid ${tokens.colors.surface.border}` }}>
        <Stack spacing={3}>
          <Typography variant="h1">SISTEMA ADALTO</Typography>
          <Typography variant="body1" color="text.secondary">
            Fundacao da plataforma multi-tenant inicializada com tokens centralizados,
            estrutura de dados base e padroes de API para as proximas historias.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip label="Sucesso" sx={{ backgroundColor: tokens.colors.success, color: tokens.colors.text.inverse }} />
            <Chip label="Atencao" sx={{ backgroundColor: tokens.colors.warning, color: tokens.colors.text.primary }} />
            <Chip label="Erro" sx={{ backgroundColor: tokens.colors.error, color: tokens.colors.text.inverse }} />
            <Chip label="Pendencia" sx={{ backgroundColor: tokens.colors.pending, color: tokens.colors.text.inverse }} />
            <Chip label="Processamento" sx={{ backgroundColor: tokens.colors.processing, color: tokens.colors.text.inverse }} />
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
