import { Box, Paper, Stack, Typography } from "@mui/material";
import { Timeline as TimelineIcon } from "@mui/icons-material";
import { tokens } from "@/lib/theme/tokens";
import type { AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function StatusTimeline({ items }: { items: AuditTimelineEntry[] }) {
  return (
    <Paper elevation={0} sx={{ p: 4, borderRadius: 6, border: `1px solid ${tokens.colors.surface.border}` }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon color="primary" />
          <Typography variant="h3">Linha do tempo</Typography>
        </Box>
        
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum evento cronológico para os filtros atuais.
          </Typography>
        ) : (
          <Stack spacing={2} component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {items.map((item, index) => (
              <Box 
                component="li"
                key={item.event_id} 
                sx={{ 
                  position: 'relative',
                  pl: 3,
                  pb: index === items.length - 1 ? 0 : 2,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: tokens.colors.action,
                    border: `3px solid white`,
                    boxShadow: tokens.effects.shadow.sm,
                    zIndex: 1
                  },
                  '&::after': index === items.length - 1 ? {} : {
                    content: '""',
                    position: 'absolute',
                    left: 5,
                    top: 20,
                    width: 2,
                    height: '100%',
                    bgcolor: tokens.colors.surface.border
                  }
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.action}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {item.status} · {formatDateTime(item.occurred_at)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
