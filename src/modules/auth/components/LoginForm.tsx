"use client";

import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Stack,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  BadgeOutlined,
  Visibility,
  VisibilityOff,
  LockOutlined,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { tokens } from "@/lib/theme/tokens";
import { formatCpf } from "@/lib/validation/cpf";

export function LoginForm() {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf,
          password,
          tenant_id: tenantId.trim() || undefined,
        }),
      });

      const result = await response.json() as {
        data?: { role?: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(result.error?.message || "Erro ao realizar login.");
      }

      // Redirecionamento baseado na role retornada pela API
      const role = result.data?.role;
      if (role === "admin_plataforma") {
        router.push("/rh/indicadores");
      } else if (role === "rh" || role === "rh_operator" || role === "rh_gestor" || role === "suporte") {
        router.push("/rh");
      } else {
        router.push("/documents");
      }
      router.refresh(); // Atualiza o estado da sessao nos layouts
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao realizar login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        width: "100%",
        maxWidth: 400,
        background: tokens.colors.surface.glass,
        backdropFilter: tokens.effects.glass,
        border: `1px solid ${tokens.colors.surface.border}`,
        borderRadius: 4,
        boxShadow: tokens.effects.shadow.lg,
      }}
    >
      <Stack spacing={3} component="form" onSubmit={handleSubmit}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="h2" sx={{ fontSize: "1.75rem", mb: 1, color: tokens.colors.primary }}>
            Bem-vindo de volta
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Acesse sua conta corporativa
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="CPF"
          type="text"
          fullWidth
          required
          value={cpf}
          onChange={(e) => setCpf(formatCpf(e.target.value))}
          variant="outlined"
          disabled={isLoading}
          placeholder="000.000.000-00"
          helperText="Informe o CPF usado no seu cadastro."
          slotProps={{
            htmlInput: {
              maxLength: 14,
            },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <BadgeOutlined sx={{ color: tokens.colors.text.muted }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField
          label="Senha"
          type={showPassword ? "text" : "password"}
          fullWidth
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          variant="outlined"
          disabled={isLoading}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined sx={{ color: tokens.colors.text.muted }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    disabled={isLoading}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField
          label="Tenant ID (playtesting)"
          type="text"
          fullWidth
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          variant="outlined"
          disabled={isLoading}
          helperText="Opcional. Informe apenas se seu usuário estiver vinculado a mais de um tenant."
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={isLoading}
          sx={{
            py: 1.5,
            fontSize: "1rem",
            position: "relative",
            minHeight: 48,
          }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : "Entrar"}
        </Button>

        <Typography variant="body2" sx={{ textAlign: "center" }} color="text.secondary">
          Esqueceu sua senha? Entre em contato com o RH.
        </Typography>
      </Stack>
    </Paper>
  );
}
