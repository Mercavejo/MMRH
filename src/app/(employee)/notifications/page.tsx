import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listEmployeeNotifications } from "@/lib/notifications/employee-notification-tracking";
import { NotificationReadButton } from "./notification-read-button";

type NotificationItem = Awaited<ReturnType<typeof listEmployeeNotifications>>[number];

export const dynamic = "force-dynamic";

export function EmployeeNotificationsPageView({
  items,
  errorMessage,
}: {
  items: NotificationItem[];
  errorMessage?: string;
}) {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h2">Historico de Notificacoes</Typography>

          <Typography variant="body2" color="text.secondary">
            Acompanhe atualizacoes de documento e contestacao com orientacao objetiva.
          </Typography>

          <Button href="/documents" variant="outlined">
            Voltar para Meus Documentos
          </Button>

          {errorMessage ? (
            <Alert severity="error" role="alert">
              {errorMessage}
            </Alert>
          ) : null}

          {!errorMessage && items.length === 0 ? (
            <Alert severity="info" role="status">
              Nenhuma notificacao encontrada no periodo atual. Volte para Meus Documentos para acompanhar novos eventos.
            </Alert>
          ) : null}

          {!errorMessage && items.length > 0 ? (
            <Stack spacing={2} aria-live="polite">
              {items.map((item) => (
                <Paper key={item.notification_id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {item.message}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                      Acao recomendada: {item.recommended_action}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Contexto: {item.context_type} | Atualizacao: {item.status_from} -&gt; {item.status_to} | Data: {new Date(item.created_at).toLocaleString("pt-BR")}
                    </Typography>

                    <NotificationReadButton
                      notificationId={item.notification_id}
                      initialRead={Boolean(item.read_at)}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
}

async function resolveRole(userId: string, tenantId: string) {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, userId),
        eq(userTenantMappings.tenantId, tenantId),
      ),
    )
    .limit(1);

  return mappings[0]?.role;
}

export default async function EmployeeNotificationsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return (
      <EmployeeNotificationsPageView
        items={[]}
        errorMessage="Sessao ausente. Realize login para consultar notificacoes."
      />
    );
  }

  const session = await validateSession(token);
  if (!session) {
    return (
      <EmployeeNotificationsPageView
        items={[]}
        errorMessage="Sessao invalida ou expirada. Realize login novamente."
      />
    );
  }

  const role = await resolveRole(session.userId, session.tenantId);

  if (role !== "colaborador") {
    redirect("/rh");
  }

  let items: NotificationItem[] = [];
  let errorMessage: string | undefined;

  try {
    items = await listEmployeeNotifications({
      tenantId: session.tenantId,
      userId: session.userId,
    });
  } catch {
    errorMessage = "Falha ao carregar notificacoes. Tente novamente em instantes.";
  }

  return <EmployeeNotificationsPageView items={items} errorMessage={errorMessage} />;
}
