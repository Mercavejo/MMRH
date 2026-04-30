'use client';

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import { tokens } from '@/lib/theme/tokens';

export type StatusChipStatus = keyof typeof tokens.statusColors;

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: string;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0f172a' : '#ffffff';
}

export function StatusChip({ status, label, sx, ...rest }: StatusChipProps) {
  const bgColor = tokens.statusColors[status as StatusChipStatus] ?? tokens.statusColors.neutral;
  const textColor = getContrastColor(bgColor);
  const baseSx = {
    bgcolor: bgColor,
    color: textColor,
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.3px',
  };

  return (
    <Chip
      label={label}
      size="small"
      sx={[baseSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      {...rest}
    />
  );
}
