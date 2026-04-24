'use client';

import React from 'react';
import { Alert, type AlertProps, Typography, Box } from '@mui/material';

interface ErrorAlertProps {
  message: string;
  severity?: AlertProps['severity'];
  action?: string;
}

export function ErrorAlert({ message, severity = 'error', action }: ErrorAlertProps) {
  return (
    <Alert
      severity={severity}
      sx={{
        borderRadius: 3,
        '& .MuiAlert-message': {
          width: '100%',
        },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {message}
      </Typography>
      {action && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 Próximo passo: {action}
          </Typography>
        </Box>
      )}
    </Alert>
  );
}
