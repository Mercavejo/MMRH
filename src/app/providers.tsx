"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { muiTheme } from "@/lib/theme/mui-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
