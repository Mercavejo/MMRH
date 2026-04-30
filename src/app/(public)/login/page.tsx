import { Box, Container, Typography, Stack, Link as MuiLink } from "@mui/material";
import NextLink from "next/link";
import { LoginForm } from "@/modules/auth/components/LoginForm";
import { tokens } from "@/lib/theme/tokens";

export default function LoginPage() {
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
          <LoginForm />
          <Typography variant="body2" color="rgba(255,255,255,0.7)">
            Primeiro acesso?{" "}
            <MuiLink component={NextLink} href="/primeiro-acesso" sx={{ color: "white", textDecoration: "underline" }}>
              Ativar conta
            </MuiLink>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
