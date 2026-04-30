export const tokens = {
  colors: {
    primary: "#1a365d",
    secondary: "#334155",
    action: "#14b8a6",
    success: "#10b981",
    warning: "#f59e0b",
    error: "#dc2626",
    danger: "#dc2626",
    pending: "#f97316",
    processing: "#0ea5e9",
    surface: {
      background: "#f8fafc",
      card: "#ffffff",
      border: "#dbe3ee",
      subtle: "#f7fafc",
      glass: "rgba(255, 255, 255, 0.7)",
    },
    text: {
      primary: "#0f172a",
      muted: "#475569",
      inverse: "#ffffff",
    },
  },
  statusColors: {
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    processing: "#38bdf8",
    pending: "#94a3b8",
    neutral: "#94a3b8",
  },
  effects: {
    glass: "blur(12px)",
    shadow: {
      sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
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
