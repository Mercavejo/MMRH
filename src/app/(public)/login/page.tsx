import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { ArrowForward as ArrowForwardIcon } from "@mui/icons-material";
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
        <Stack spacing={3} sx={{ alignItems: "center" }}>
          <LoginForm />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 1 }}>
              Primeiro acesso ao portal?
            </Typography>
            <Button
              href="/primeiro-acesso"
              variant="outlined"
              endIcon={<ArrowForwardIcon />}
              sx={{
                color: tokens.colors.action,
                borderColor: tokens.colors.action,
                borderRadius: 3,
                px: 4,
                py: 1.25,
                fontWeight: 600,
                fontSize: "0.875rem",
                textTransform: "none",
                backdropFilter: "blur(8px)",
                backgroundColor: "rgba(255,255,255,0.06)",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderColor: tokens.colors.action,
                },
                "&:focus-visible": {
                  outline: `2px solid ${tokens.colors.action}`,
                  outlineOffset: 2,
                },
              }}
            >
              Ativar conta
            </Button>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
