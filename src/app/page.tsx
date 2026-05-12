import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { Button, Container, Paper, Stack, Typography, Box } from "@mui/material";
import { BRAND_LONG_NAME } from "@/lib/brand";
import { tokens } from "@/lib/theme/tokens";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const session = await validateSession(token);
    if (session) {
      const [mapping] = await db
        .select({ role: userTenantMappings.role })
        .from(userTenantMappings)
        .where(
          and(
            eq(userTenantMappings.userId, session.userId),
            eq(userTenantMappings.tenantId, session.tenantId)
          )
        )
        .limit(1);

      if (
        mapping?.role === "rh_operator" ||
        mapping?.role === "rh_gestor" ||
        mapping?.role === "suporte" ||
        mapping?.role === "admin_plataforma"
      ) {
        redirect("/rh");
      } else if (mapping?.role === "colaborador") {
        redirect("/documents");
      }
    }
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: `radial-gradient(circle at top right, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
      p: 2
    }}>
      <Container maxWidth="sm">
        <Paper 
          elevation={0} 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 8,
            boxShadow: tokens.effects.shadow.lg
          }}
        >
          <Stack spacing={4}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: tokens.colors.primary }}>
              {BRAND_LONG_NAME}
              <Box component="span" sx={{ color: tokens.colors.action }}>.</Box>
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
              Gestão documental inteligente e segura para o colaborador moderno.
            </Typography>

            <Button 
              href="/login" 
              variant="contained" 
              size="large"
              fullWidth
              sx={{ py: 2, fontSize: '1.1rem' }}
            >
              Acessar minha conta
            </Button>
            
            <Typography variant="body2" color="text.muted">
              Consulte holerites, cartões de ponto e notificações em um só lugar.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
