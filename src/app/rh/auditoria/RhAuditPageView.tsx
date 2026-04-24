"use client";

import { 
  Box, 
  Container, 
  Paper, 
  Stack, 
  Typography, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  TextField,
  Grid
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History as HistoryIcon, 
  FilterList as FilterIcon 
} from "@mui/icons-material";
import { tokens } from "@/lib/theme/tokens";
import { StatusTimeline } from "@/components/audit/status-timeline";
import { SupportCasePanel } from "@/components/support/support-case-panel";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { StatusChip } from "@/components/ui/StatusChip";
import type { AuditEventRecord, AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";
import type { SupportCase } from "@/modules/support/domain/support-case";

export type RhAuditFilters = {
  from: string;
  to: string;
  batch_id: string;
  document_id: string;
  user_id: string;
  case_id: string;
  page: number;
  page_size: number;
};

export type AuditPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

function getAuditStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "completed") return "success";
  if (normalized === "failure" || normalized === "failed" || normalized === "error") return "error";
  if (normalized === "warning" || normalized === "partial") return "warning";
  if (normalized === "processing" || normalized === "running") return "processing";
  if (normalized === "pending") return "pending";
  return "neutral";
}

export function RhAuditPageView(props: {
  filters: RhAuditFilters;
  events: AuditEventRecord[];
  timeline: AuditTimelineEntry[];
  pagination: AuditPagination;
  supportCase: SupportCase | null;
  supportCaseError?: string | null;
  errorMessage?: string | null;
}) {
  const { filters, events, timeline, pagination, supportCase, supportCaseError, errorMessage } = props;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <HistoryIcon fontSize="inherit" color="primary" />
            Trilha de Auditoria
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Consulte log de eventos, ações de usuários e auditoria de sistema com visibilidade completa por tenant.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ p: 4, borderRadius: 6, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon color="primary" />
              <Typography variant="h3">Filtros de Pesquisa</Typography>
            </Box>
            
            <form method="get">
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="De"
                    type="datetime-local"
                    name="from"
                    defaultValue={filters.from}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Até"
                    type="datetime-local"
                    name="to"
                    defaultValue={filters.to}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Lote ID"
                    name="batch_id"
                    defaultValue={filters.batch_id}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Documento ID"
                    name="document_id"
                    defaultValue={filters.document_id}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Usuário ID"
                    name="user_id"
                    defaultValue={filters.user_id}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Case ID"
                    name="case_id"
                    defaultValue={filters.case_id}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Página"
                    type="number"
                    name="page"
                    defaultValue={filters.page}
                    slotProps={{ htmlInput: { min: 1 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    fullWidth 
                    size="large"
                    sx={{ height: '56px', borderRadius: 2 }}
                  >
                    Aplicar Filtros
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Stack>
        </Paper>

        {errorMessage && (
          <ErrorAlert
            message={errorMessage}
            action="Revise os filtros aplicados. Se o erro continuar, registre o case_id e acione o suporte técnico."
          />
        )}

        <Paper elevation={0} sx={{ p: 4, borderRadius: 6, border: `1px solid ${tokens.colors.surface.border}` }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h3">Eventos de Auditoria</Typography>
              <Typography variant="body2" color="text.secondary">
                Página {pagination.page} de {pagination.total_pages} ({pagination.total} eventos)
              </Typography>
            </Box>

            <AnimatePresence mode="wait">
              <motion.div
                key={JSON.stringify(events.map(e => e.id))}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {events.length === 0 ? (
                  <Box sx={{ py: 8, textAlign: 'center' }}>
                    <Typography color="text.secondary">Nenhum evento encontrado para os filtros atuais.</Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ 
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: tokens.colors.surface.border, borderRadius: 3 },
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 40,
                      height: '100%',
                      background: 'linear-gradient(to left, rgba(255,255,255,0.9), transparent)',
                      pointerEvents: 'none',
                    },
                  }}>
                    <Table sx={{ minWidth: 800 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Ação</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Recurso</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Ator</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {events.map((event) => (
                          <TableRow 
                            key={event.id}
                            sx={{ 
                              '&:hover': { bgcolor: 'rgba(15, 23, 42, 0.02)' },
                              transition: 'background-color 0.2s'
                            }}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {event.action}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                ID: {event.id.substring(0, 8)}...
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <StatusChip status={getAuditStatusTone(event.status)} label={event.status.toUpperCase()} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{event.resource_type}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {event.resource_id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{event.actor_id ?? "sistema"}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(event.created_at).toLocaleString("pt-BR")}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </motion.div>
            </AnimatePresence>
          </Stack>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '400px 1fr' }, gap: 4, alignItems: 'start' }}>
          <StatusTimeline items={timeline} />
          <SupportCasePanel supportCase={supportCase} errorMessage={supportCaseError} isLoading={false} />
        </Box>
      </Stack>
    </Container>
  );
}
