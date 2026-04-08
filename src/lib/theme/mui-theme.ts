import { createTheme } from "@mui/material/styles";
import { tokens } from "@/lib/theme/tokens";

export const muiTheme = createTheme({
  palette: {
    primary: { main: tokens.colors.primary },
    success: { main: tokens.colors.success },
    warning: { main: tokens.colors.warning },
    error: { main: tokens.colors.error },
    background: {
      default: tokens.colors.surface.background,
      paper: tokens.colors.surface.card,
    },
    text: {
      primary: tokens.colors.text.primary,
      secondary: tokens.colors.text.muted,
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: tokens.typography.fontFamily,
    h1: {
      fontSize: tokens.typography.h1.fontSize,
      fontWeight: tokens.typography.h1.fontWeight,
      lineHeight: tokens.typography.h1.lineHeight,
    },
    h2: {
      fontSize: tokens.typography.h2.fontSize,
      fontWeight: tokens.typography.h2.fontWeight,
      lineHeight: tokens.typography.h2.lineHeight,
    },
    h3: {
      fontSize: tokens.typography.h3.fontSize,
      fontWeight: tokens.typography.h3.fontWeight,
      lineHeight: tokens.typography.h3.lineHeight,
    },
    body1: {
      fontSize: tokens.typography.body.fontSize,
      fontWeight: tokens.typography.body.fontWeight,
      lineHeight: tokens.typography.body.lineHeight,
    },
    body2: {
      fontSize: tokens.typography.bodySmall.fontSize,
      fontWeight: tokens.typography.bodySmall.fontWeight,
      lineHeight: tokens.typography.bodySmall.lineHeight,
    },
  },
});
