import { and, eq } from "drizzle-orm";
import { Alert, Container, Paper, Stack, Typography, Chip } from "@mui/material";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listEmployeeIdentities } from "@/modules/employee-identity/application/list-employee-identities";
import type { EmployeeIdentityListItem } from "@/modules/employee-identity/application/types";
import { tokens } from "@/lib/theme/tokens";
import { RhEmployeesManager } from "./rh-employees-manager";

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function loadEmployeesPageState() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return {
      canManage: false,
      errorMessage: "Sessao ausente.",
      items: [] as EmployeeIdentityListItem[],
      tenantId: null,
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      canManage: false,
      errorMessage: "Sessao invalida ou expirada.",
      items: [] as EmployeeIdentityListItem[],
      tenantId: null,
    };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return {
      canManage: false,
      errorMessage: "Usuario sem permissao no tenant.",
      items: [] as EmployeeIdentityListItem[],
      tenantId: null,
    };
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantWrite,
    });
  } catch {
    return {
      canManage: false,
      errorMessage: "Acesso negado pelo RBAC.",
      items: [] as EmployeeIdentityListItem[],
      tenantId: null,
    };
  }

  if (role !== "rh_operator" && role !== "rh_gestor" && role !== "admin_plataforma") {
    return {
      canManage: false,
      errorMessage: "Perfil sem permissao para gerir colaboradores.",
      items: [] as EmployeeIdentityListItem[],
      tenantId: null,
    };
  }

  try {
    const data = await listEmployeeIdentities({
      tenantId: session.tenantId,
      filters: {},
    });

    return {
      canManage: true,
      errorMessage: null,
      items: data.items,
      tenantId: session.tenantId,
    };
  } catch {
    return {
      canManage: false,
      errorMessage: "Falha ao carregar colaboradores funcionais. Tente novamente em instantes.",
      items: [] as EmployeeIdentityListItem[],
    };
  }
}

export function RhEmployeesPageView({
  canManage,
  errorMessage,
  initialItems,
  tenantId,
}: {
  canManage: boolean;
  errorMessage: string | null;
  initialItems: EmployeeIdentityListItem[];
  tenantId: string | null;
}) {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 4,
            border: `1px solid ${tokens.colors.surface.border}`,
            background: `linear-gradient(135deg, ${tokens.colors.surface.card} 0%, #edf4fb 100%)`,
          }}
        >
          <Stack spacing={2}>
            <Stack spacing={1}>
              <Typography variant="overline" sx={{ letterSpacing: 1.4 }}>
                Operacao RH / Colaboradores
              </Typography>
              <Typography variant="h2">Cadastro de colaboradores</Typography>
              <Typography variant="body1" color="text.secondary">
                Cadastre nome, Codigo de referencia, Verificador secundario e status funcional para preparar a ativacao segura.
              </Typography>
            </Stack>
            {tenantId && (
              <Chip
                label={`Codigo da empresa: ${tenantId}`}
                variant="outlined"
                size="small"
                sx={{ fontFamily: "monospace", alignSelf: "flex-start" }}
              />
            )}
          </Stack>
        </Paper>

        {errorMessage ? <Alert severity="warning">{errorMessage}</Alert> : null}
        {canManage ? <RhEmployeesManager initialItems={initialItems} /> : null}
      </Stack>
    </Container>
  );
}

export default async function RhEmployeesPage() {
  const state = await loadEmployeesPageState();

  return (
    <RhEmployeesPageView
      canManage={state.canManage}
      errorMessage={state.errorMessage}
      initialItems={state.items}
      tenantId={state.tenantId}
    />
  );
}
