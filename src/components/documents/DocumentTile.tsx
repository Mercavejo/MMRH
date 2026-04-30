'use client';

import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Stack, 
  Typography, 
  Button, 
  IconButton, 
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Visibility as VisibilityIcon, 
  Description as DescriptionIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { tokens } from '@/lib/theme/tokens';
import { DocumentStatusChip } from '@/lib/documents/document-status-chip';
import type { DocumentStatus } from '@/lib/documents/status-mapping';
import Link from 'next/link';

interface DocumentTileProps {
  type: string;
  period: string;
  status: DocumentStatus;
  downloadHref: string;
  detailsHref: string;
  contestationHref?: string;
}

const STATUS_ICONS = {
  published: <CheckCircleIcon sx={{ color: tokens.colors.success }} />,
  success: <CheckCircleIcon sx={{ color: tokens.colors.success }} />,
  pending: <ScheduleIcon sx={{ color: tokens.colors.pending }} />,
  processing: <ScheduleIcon sx={{ color: tokens.colors.processing }} />,
  unavailable: <ErrorIcon sx={{ color: tokens.colors.warning }} />,
  error: <ErrorIcon sx={{ color: tokens.colors.error }} />,
};

export function DocumentTile({ 
  type, 
  period, 
  status, 
  downloadHref, 
  detailsHref,
  contestationHref 
}: DocumentTileProps) {
  const isAvailable = status === 'published';

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2, 
        transition: 'all 0.2s', 
        '&:hover': { 
          transform: 'translateY(-2px)',
          borderColor: tokens.colors.action,
          boxShadow: tokens.effects.shadow.md 
        } 
      }}
    >
      <CardContent sx={{ p: '20px !important' }}>
        <Stack 
          direction={{ xs: 'column', md: 'row' }} 
          spacing={3} 
          sx={{
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 1.5, 
                borderRadius: 3, 
                bgcolor: 'rgba(15, 23, 42, 0.05)',
                color: tokens.colors.primary,
                display: 'flex'
              }}
            >
              <DescriptionIcon />
            </Paper>
            <Box>
              <Typography variant="h3" sx={{ fontSize: '1rem', mb: 0.5 }}>
                {type}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Referência: {period}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {STATUS_ICONS[status as keyof typeof STATUS_ICONS] || null}
              <DocumentStatusChip status={status} />
            </Box>
            
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, height: 24, mx: 1 }} />

            <Stack direction="row" spacing={1}>
              <Tooltip title="Ver Detalhes">
                <IconButton 
                  component={Link} 
                  href={detailsHref}
                  aria-label={`Ver detalhes de ${type} ${period}`}
                  sx={{ color: tokens.colors.text.muted }}
                >
                  <VisibilityIcon />
                </IconButton>
              </Tooltip>
              
              <Button
                component={Link}
                href={downloadHref}
                variant={isAvailable ? "contained" : "outlined"}
                disabled={!isAvailable}
                startIcon={<DownloadIcon />}
                size="small"
                aria-label={`Baixar ${type} ${period}`}
                sx={{ 
                  borderRadius: 2,
                  px: 3,
                  py: 1
                }}
              >
                Download
              </Button>

              {contestationHref && (
                <Button
                  component={Link}
                  href={contestationHref}
                  variant="outlined"
                  color="warning"
                  size="small"
                  aria-label={`Abrir contestacao para ${type} ${period}`}
                  sx={{ borderRadius: 2 }}
                >
                  Abrir contestacao
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
