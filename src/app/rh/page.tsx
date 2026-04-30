import React from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Stack, 
  Typography, 
  Button, 
  Card,
  CardContent
} from '@mui/material';
import { 
  Assessment as AssessmentIcon, 
  ErrorOutlined as ErrorIcon, 
  CheckCircleOutlined as SuccessIcon,
  Timeline as TimelineIcon,
  ArrowForward as ArrowIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { tokens } from '@/lib/theme/tokens';
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";
import { getDashboardSummary } from '@/modules/indicators/application/get-dashboard-summary';
import { loadLatestBatch, type BatchPublicationSnapshot } from '@/modules/batches/infrastructure/batch-repository';
import { CountUpValue } from '@/components/ui/CountUpValue';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

async function recordPlaytestEvent(params: Parameters<typeof writePlaytestEvent>[0]) {
  try {
    await writePlaytestEvent(params);
  } catch (error) {
    console.error("[playtest.dashboard] Falha ao registrar evento", error);
  }
}

function formatRelativeTime(date: Date | string | null) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (diffInSeconds < 0) return 'agora';
  if (diffInSeconds < 60) return 'agora';
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
  return `há ${Math.floor(diffInSeconds / 86400)} dias`;
}

async function getUserData(userId: string, tenantId: string) {
  const [userData] = await db
    .select({
      name: users.name,
      role: userTenantMappings.role,
    })
    .from(users)
    .innerJoin(userTenantMappings, eq(users.id, userTenantMappings.userId))
    .where(and(eq(users.id, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return userData;
}

function formatBatchStatus(status: string | null) {
  switch (status) {
    case 'published':
      return 'Publicado com sucesso';
    case 'publishing':
      return 'Publicando';
    case 'failed':
      return 'Falha no envio';
    case 'processed':
      return 'Processado';
    case 'processing':
      return 'Processando';
    case 'pending':
      return 'Pendente';
    default:
      return 'Aguardando atualização';
  }
}

export default async function RHDashboardPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const correlationId = resolveCorrelationId(headerStore.get(CORRELATION_ID_HEADER));
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSession(token) : null;
  
  if (!session) {
    redirect('/login');
  }

  const userData = await getUserData(session.userId, session.tenantId);
  if (!userData) {
    redirect('/login');
  }

  const isInternalRole = ['admin_plataforma', 'suporte'].includes(userData.role);

  if (!isInternalRole) {
    let latestBatch: BatchPublicationSnapshot | null = null;

    try {
      latestBatch = await loadLatestBatch({ tenantId: session.tenantId });
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.dashboard.view",
        resourceType: "dashboard",
        resourceId: "client_dashboard",
        status: "success",
        details: {
          latest_batch_id: latestBatch?.id ?? null,
          publication_status: latestBatch?.publicationStatus ?? null,
          routing_status: latestBatch?.routingStatus ?? null,
        },
      });
    } catch {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.dashboard.friction",
        resourceType: "dashboard",
        resourceId: "client_dashboard",
        status: "failure",
        details: {
          cause: "internal_error",
          reason: "Falha ao carregar ultimo lote do dashboard cliente",
        },
      });
      return (
        <ErrorAlert
          message="Não foi possível carregar o painel de envios."
          action="Atualize a página. Se o problema continuar, abra um chamado técnico para a equipe Mercavejo."
        />
      );
    }

    return <ClientDashboard latestBatch={latestBatch} />;
  }

  let dashboardData: Awaited<ReturnType<typeof getDashboardSummary>>;
  try {
    dashboardData = await getDashboardSummary({ tenantId: session.tenantId });
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.dashboard.internal.view",
      resourceType: "dashboard",
      resourceId: "internal_dashboard",
      status: "success",
      details: {
        actor_role: userData.role,
      },
    });
  } catch {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.dashboard.internal.friction",
      resourceType: "dashboard",
      resourceId: "internal_dashboard",
      status: "failure",
      details: {
        actor_role: userData.role,
        cause: "internal_error",
        reason: "Falha ao carregar painel interno",
      },
    });
    return (
      <ErrorAlert
        message="Não foi possível carregar o painel de gestão."
        action="Atualize a página. Se o problema continuar, consulte a auditoria ou acione o suporte técnico."
      />
    );
  }

  const { summary, recentActivities } = dashboardData;
  const hasData = summary.totalBatches > 0;

  const canManageBatches = userData.role === "admin_plataforma";
  const canReviewExceptions = userData.role === "admin_plataforma";
  const canReviewAudit = ["admin_plataforma", "suporte"].includes(userData.role);

  return (
    <Box>
      <Stack spacing={4}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 1 }}>
              Painel de Gestão RH
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Visão geral da operação, indicadores de performance e tratamento de exceções.
            </Typography>
          </Box>
          {canManageBatches ? (
            <Button
              href="/rh/lotes"
              variant="contained"
              startIcon={<UploadIcon />}
              sx={{ px: 4, py: 1.5, width: { xs: '100%', sm: 'auto' } }}
            >
              Importar Novo Relatório
            </Button>
          ) : null}
        </Box>

        {!hasData ? (
          <EmptyState />
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 3 }}>
                <SummaryCard 
                  title="Lotes Processados" 
                  value={summary.totalBatches} 
                  subtitle={summary.latestBatch ? `Último: ${summary.latestBatch.id}` : 'Nenhum lote'}
                  icon={<AssessmentIcon />} 
                  color={tokens.colors.primary} 
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <SummaryCard 
                  title="Fila de Exceções" 
                  value={summary.pendingExceptions} 
                  subtitle={`${summary.pendingExceptions > 0 ? 'Ações pendentes' : 'Nenhuma pendência'}`}
                  icon={<ErrorIcon />} 
                  color={summary.pendingExceptions > 10 ? tokens.colors.error : tokens.colors.warning} 
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <SummaryCard 
                  title="Acurácia de Envios" 
                  value={summary.accuracy} 
                  suffix="%"
                  decimals={1}
                  subtitle="Meta: 99.0%"
                  icon={<SuccessIcon />} 
                  color={summary.accuracy >= 99 ? tokens.colors.success : tokens.colors.warning} 
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <SummaryCard 
                  title="Status do Sistema" 
                  value={100} 
                  suffix="%"
                  decimals={0}
                  subtitle="Operação Normal"
                  icon={<TimelineIcon />} 
                  color={tokens.colors.processing} 
                />
              </Grid>
            </Grid>

            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper sx={{ p: 4, borderRadius: 6 }}>
                  <Stack spacing={3}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
                      <Typography variant="h3">Atividades Recentes</Typography>
                      {canReviewAudit ? (
                        <Button href="/rh/auditoria" variant="text" endIcon={<ArrowIcon />}>
                          Ver Auditoria Completa
                        </Button>
                      ) : null}
                    </Box>
                    
                    <Stack spacing={2}>
                      {recentActivities.length > 0 ? (
                        recentActivities.map((activity) => (
                          <ActivityItem 
                            key={activity.id}
                            title={activity.action} 
                            time={formatRelativeTime(activity.timestamp)} 
                            desc={activity.description} 
                            type={activity.status === 'failure' ? 'error' : 'success'}
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          Nenhuma atividade recente registrada.
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={3}>
                  <Paper 
                    sx={{ 
                      p: 4, 
                      borderRadius: 6, 
                      background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
                      color: 'white'
                    }}
                  >
                    <Typography variant="h3" sx={{ color: 'white', mb: 2 }}>Acesso Rápido</Typography>
                    <Stack spacing={1}>
                      {canManageBatches ? (
                        <QuickActionButton label="Processamento de Lotes" href="/rh/lotes" />
                      ) : null}
                      {canReviewAudit ? (
                        <QuickActionButton label="Exportar Relatório de Auditoria" href="/rh/auditoria" />
                      ) : null}
                      {canReviewExceptions ? (
                        <QuickActionButton label="Fila de Exceções" href="/rh/excecoes" />
                      ) : null}
                    </Stack>
                  </Paper>

                  <Card variant="outlined" sx={{ borderRadius: 6 }}>
                    <CardContent sx={{ p: 4 }}>
                      <Typography variant="h3" sx={{ mb: 2 }}>Suporte Interno</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Precisa de ajuda com a integração ou parametrização de documentos?
                      </Typography>
                      <Button
                        component="a"
                        href="mailto:suporte@adalto.local?subject=Chamado%20t%C3%A9cnico%20Sistema%20Adalto"
                        variant="outlined"
                        fullWidth
                        color="primary"
                      >
                        Abrir Chamado Técnico
                      </Button>
                    </CardContent>
                  </Card>
                </Stack>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Box>
  );
}

function ClientDashboard({ latestBatch }: { latestBatch: BatchPublicationSnapshot | null }) {
  return (
    <Box>
      <Stack spacing={4}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 1 }}>
              Envios e Acompanhamento
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Envie lotes, acompanhe o resultado funcional do processamento e acione a Mercavejo quando precisar de ajuda.
            </Typography>
          </Box>
          <Button
            href="/rh/lotes"
            variant="contained"
            startIcon={<UploadIcon />}
            sx={{ px: 4, py: 1.5, width: { xs: '100%', sm: 'auto' } }}
          >
            Enviar Novo Lote
          </Button>
        </Box>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 4, borderRadius: 6 }}>
              <Stack spacing={3}>
                <Typography variant="h3">Último envio</Typography>

                {latestBatch ? (
                  <Stack spacing={2}>
                    <SummaryCard
                      title="Status do lote"
                      value={latestBatch.routingTotalCount}
                      subtitle={`${formatBatchStatus(latestBatch.publicationStatus)} · Lote ${latestBatch.id}`}
                      icon={<TimelineIcon />}
                      color={latestBatch.lastPublicationError ? tokens.colors.error : tokens.colors.primary}
                    />
                    <Paper sx={{ p: 3, borderRadius: 4, bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                      <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                          Status do processamento: {formatBatchStatus(latestBatch.routingStatus)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Última atualização: {formatRelativeTime(latestBatch.routingProcessedAt ?? latestBatch.publishedAt)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Itens no lote: {latestBatch.routingTotalCount}
                        </Typography>
                        {latestBatch.lastPublicationError ? (
                          <Typography variant="body2" sx={{ color: tokens.colors.error, fontWeight: 600 }}>
                            Erro funcional: {latestBatch.lastPublicationError}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Paper>
                  </Stack>
                ) : (
                  <ClientEmptyState />
                )}
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
                  color: 'white'
                }}
              >
                <Typography variant="h3" sx={{ color: 'white', mb: 2 }}>Acesso Rápido</Typography>
                <Stack spacing={1}>
                  <QuickActionButton label="Ver lotes e histórico" href="/rh/lotes" />
                </Stack>
              </Paper>

              <Card variant="outlined" sx={{ borderRadius: 6 }}>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h3" sx={{ mb: 2 }}>Suporte Mercavejo</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Se houver falha ou comportamento inesperado, abra um chamado técnico para o time interno.
                  </Typography>
                  <Button
                    component="a"
                    href="mailto:suporte@adalto.local?subject=Chamado%20t%C3%A9cnico%20Sistema%20Adalto"
                    variant="outlined"
                    fullWidth
                    color="primary"
                  >
                    Abrir Chamado Técnico
                  </Button>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}

interface SummaryCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
  decimals?: number;
}

function SummaryCard({ title, value, subtitle, icon, color, suffix = '', decimals = 0 }: SummaryCardProps) {
  return (
    <Paper sx={{ 
      p: 3, 
      borderRadius: 5, 
      borderBottom: `4px solid ${color}`,
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: tokens.effects.shadow.lg,
      }
    }}>
      <Stack spacing={2}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{title}</Typography>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
        <Box>
          <CountUpValue 
            value={typeof value === 'number' ? value : parseFloat(value)} 
            suffix={suffix} 
            decimals={decimals}
            sx={{ mb: 0.5, fontWeight: 800 }} 
          />
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

type ActivityItemType = 'success' | 'error' | 'info';

interface ActivityItemProps {
  title: string;
  time: string;
  desc: string;
  type: ActivityItemType;
}

function ActivityItem({ title, time, desc, type }: ActivityItemProps) {
  const colors = {
    success: tokens.colors.success,
    error: tokens.colors.error,
    info: tokens.colors.processing,
  };
  
  return (
    <Box sx={{ 
      p: 2, 
      borderRadius: 3, 
      bgcolor: 'rgba(15, 23, 42, 0.02)',
      borderLeft: `3px solid ${colors[type as keyof typeof colors]}`,
      transition: 'all 0.2s ease',
      '&:hover': {
        bgcolor: 'rgba(15, 23, 42, 0.04)',
      }
    }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
              {title.replace(/-/g, ' ')}
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.colors.text.muted, fontWeight: 600 }}>{time}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">{desc}</Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function QuickActionButton({ label, href }: { label: string; href: string }) {
  return (
    <Button
      href={href}
      variant="text"
      sx={{
        color: 'white',
        justifyContent: 'flex-start',
        px: 1,
        py: 1,
        borderRadius: 2,
        opacity: 0.8,
        '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.1)' }
      }}
      endIcon={<ArrowIcon fontSize="small" />}
      fullWidth
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
    </Button>
  );
}

function EmptyState() {
  return (
    <Paper 
      sx={{ 
        p: 8, 
        textAlign: 'center', 
        borderRadius: 8, 
        border: `2px dashed ${tokens.colors.surface.border}`,
        bgcolor: 'transparent'
      }}
    >
      <Stack spacing={3} sx={{ alignItems: 'center' }}>
        <Box sx={{ 
          p: 3, 
          borderRadius: '50%', 
          bgcolor: 'rgba(45, 212, 191, 0.1)',
          color: tokens.colors.primary 
        }}>
          <UploadIcon sx={{ fontSize: 48 }} />
        </Box>
        <Box sx={{ maxWidth: 400 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>Nenhum dado disponível</Typography>
          <Typography variant="body1" color="text.secondary">
            Seu dashboard está vazio porque ainda não foram processados lotes para este tenant. 
            Comece importando seu primeiro lote de documentos.
          </Typography>
        </Box>
        <Button
          href="/rh/lotes"
          variant="contained"
          size="large"
          startIcon={<UploadIcon />}
          sx={{ px: 4, py: 2, borderRadius: 4 }}
        >
          Importar Primeiro Lote
        </Button>
      </Stack>
    </Paper>
  );
}

function ClientEmptyState() {
  return (
    <Paper
      sx={{
        p: 6,
        textAlign: 'center',
        borderRadius: 6,
        border: `2px dashed ${tokens.colors.surface.border}`,
        bgcolor: 'transparent'
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            p: 2.5,
            borderRadius: '50%',
            bgcolor: 'rgba(45, 212, 191, 0.1)',
            color: tokens.colors.primary
          }}
        >
          <UploadIcon sx={{ fontSize: 40 }} />
        </Box>
        <Typography variant="h3">Nenhum envio recente</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 420 }}>
          Assim que um lote for enviado, você poderá acompanhar aqui o status funcional e o histórico mais recente.
        </Typography>
      </Stack>
    </Paper>
  );
}
