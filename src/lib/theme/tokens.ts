export const tokens = {
  colors: {
    primary: "#1a365d",
    action: "#14b8a6",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#dc2626",
    pending: "#f97316",
    processing: "#0ea5e9",
    surface: {
      background: "#f8fafc",
      card: "#ffffff",
      border: "#dbe3ee",
    },
    text: {
      primary: "#0f172a",
      muted: "#475569",
      inverse: "#ffffff",
    },
  },
  typography: {
    fontFamily: "var(--font-ibm-plex-sans)",
    fontFamilyMono: "var(--font-ibm-plex-mono)",
    h1: { fontSize: "32px", fontWeight: 700, lineHeight: 1.25 },
    h2: { fontSize: "24px", fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: "18px", fontWeight: 600, lineHeight: 1.35 },
    body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.6 },
    bodySmall: { fontSize: "12px", fontWeight: 400, lineHeight: 1.6 },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;

export type DesignTokens = typeof tokens;
