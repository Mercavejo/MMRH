'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import type { TypographyProps } from '@mui/material/Typography';
import { animate } from 'framer-motion';

interface CountUpValueProps {
  value: number;
  suffix?: string;
  decimals?: number;
  variant?: TypographyProps["variant"];
  sx?: TypographyProps["sx"];
}

export function CountUpValue({ value, suffix = '', decimals = 0, variant = 'h2', sx }: CountUpValueProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate(value) {
        setDisplayValue(value);
      }
    });

    return () => controls.stop();
  }, [value]);

  const formattedValue = displayValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <Typography variant={variant} sx={sx}>
      {formattedValue}{suffix}
    </Typography>
  );
}
