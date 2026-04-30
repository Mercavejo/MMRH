'use client';

import React from 'react';
import { Box, Paper, Skeleton, Stack } from '@mui/material';
import { tokens } from '@/lib/theme/tokens';

export type SkeletonCardVariant = 'summary' | 'detail';

interface SkeletonCardProps {
  variant?: SkeletonCardVariant;
}

export function SkeletonCard({ variant = 'summary' }: SkeletonCardProps) {
  if (variant === 'detail') {
    return (
      <Paper
        sx={{
          p: 4,
          borderRadius: 5,
          border: `1px solid ${tokens.colors.surface.border}`,
        }}
      >
        <Stack spacing={3}>
          <Skeleton animation="wave" variant="text" width="60%" height={28} />
          <Skeleton animation="wave" variant="rectangular" width="100%" height={120} sx={{ borderRadius: 2 }} />
          <Stack spacing={1}>
            <Skeleton animation="wave" variant="text" width="80%" height={18} />
            <Skeleton animation="wave" variant="text" width="45%" height={18} />
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // summary variant — compact for indicator grids
  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 5,
        borderBottom: `4px solid ${tokens.colors.surface.border}`,
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Skeleton animation="wave" variant="text" width="50%" height={18} />
          <Skeleton animation="wave" variant="circular" width={24} height={24} />
        </Box>
        <Box>
          <Skeleton animation="wave" variant="text" width="40%" height={36} />
          <Skeleton animation="wave" variant="text" width="60%" height={16} />
        </Box>
      </Stack>
    </Paper>
  );
}
