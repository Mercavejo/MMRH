import { createTheme, type Shadows } from "@mui/material/styles";
import { tokens } from "@/lib/theme/tokens";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.colors.primary },
    secondary: { main: tokens.colors.secondary },
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
    borderRadius: 12,
  },
  shadows: [
    "none",
    tokens.effects.shadow.sm,
    tokens.effects.shadow.md,
    tokens.effects.shadow.lg,
    ...Array(21).fill("none"), // Filling remaining MUI shadow slots
  ] as Shadows,
  typography: {
    fontFamily: tokens.typography.fontFamily,
    h1: tokens.typography.h1,
    h2: tokens.typography.h2,
    h3: tokens.typography.h3,
    body1: tokens.typography.body,
    body2: tokens.typography.bodySmall,
  },
  components: {
    MuiButton: {
      variants: [
        {
          props: { variant: "contained", color: "primary" },
          style: {
            background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.secondary} 100%)`,
          },
        },
      ],
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          padding: "8px 20px",
          borderRadius: 10,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          transition: "box-shadow 0.3s ease",
          "&:hover": {
            boxShadow: tokens.effects.shadow.lg,
          },
        },
        rounded: {
          borderRadius: 16,
        },
        elevation1: {
          boxShadow: tokens.effects.shadow.md,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: tokens.effects.shadow.md,
          borderRadius: 20,
          border: `1px solid ${tokens.colors.surface.border}`,
          transition: "box-shadow 0.3s ease",
          "&:hover": {
            boxShadow: tokens.effects.shadow.lg,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.colors.surface.glass,
          backdropFilter: tokens.effects.glass,
          color: tokens.colors.text.primary,
          boxShadow: "none",
          borderBottom: `1px solid ${tokens.colors.surface.border}`,
        },
      },
    },
  },
});
