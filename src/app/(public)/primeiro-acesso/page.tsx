import { Box, Container, Typography, Stack, Link as MuiLink } from "@mui/material";
import { EmployeeActivationForm } from "@/modules/employee-identity/components/EmployeeActivationForm";
import { tokens } from "@/lib/theme/tokens";

export default function PrimeiroAcessoPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at top right, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
        p: 2,
      }}
    >
      <Container maxWidth="sm" sx={{ display: "flex", justifyContent: "center" }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <EmployeeActivationForm />
          <Typography variant="body2" color="rgba(255,255,255,0.7)">
            Ja tem conta?{" "}
            <MuiLink href="/login" sx={{ color: "white", textDecoration: "underline" }}>
              Fazer login
            </MuiLink>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
