export const theme = {
  surface: {
    0: "oklch(0.18 0.008 145)",
    1: "oklch(0.22 0.009 145)",
    2: "oklch(0.26 0.010 145)",
    3: "oklch(0.31 0.011 145)",
    scrim: "oklch(0.10 0.010 145 / 0.72)",
  },

  ink: {
    hi: "oklch(0.96 0.005 90)",
    mid: "oklch(0.78 0.007 90)",
    lo: "oklch(0.60 0.008 90)",
    mute: "oklch(0.45 0.008 90)",
  },

  border: {
    DEFAULT: "oklch(0.34 0.010 145 / 0.8)",
    soft: "oklch(0.34 0.010 145 / 0.4)",
    hi: "oklch(0.45 0.012 145)",
  },

  accent: {
    DEFAULT: "oklch(0.68 0.15 235)",
    hi: "oklch(0.74 0.15 235)",
    lo: "oklch(0.58 0.14 235)",
    bg: "oklch(0.68 0.15 235 / 0.14)",
    ink: "oklch(0.20 0.02 235)",
  },

  danger: {
    DEFAULT: "oklch(0.62 0.18 25)",
    bg: "oklch(0.62 0.18 25 / 0.14)",
  },

  success: {
    DEFAULT: "oklch(0.72 0.14 150)",
    bg: "oklch(0.72 0.14 150 / 0.14)",
  },

  wool: {
    DEFAULT: "oklch(0.94 0.015 85)",
    ink: "oklch(0.28 0.015 85)",
  },

  game: {
    pink: "#ff69b4",
    blue: "#1e90ff",
    green: "#32cd32",
    orange: "#ffa500",
    purple: "#9370db",
    gold: "#FFCC00",
    mana: "#5fa7ff",
  },

  radius: {
    xs: "3px",
    sm: "5px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    pill: "99px",
  },

  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },

  shadow: {
    sm: "0 1px 2px rgba(10, 14, 10, 0.4)",
    md: "0 8px 24px -8px rgba(6, 10, 6, 0.6), 0 2px 4px rgba(6, 10, 6, 0.3)",
    lg: "0 24px 48px -12px rgba(6, 10, 6, 0.7), 0 4px 8px rgba(6, 10, 6, 0.4)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  },

  font: {
    sans:
      '"Work Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    display: '"Fraunces", "Work Sans", sans-serif',
    mono:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  text: {
    xs: "11px",
    sm: "12px",
    md: "13px",
    lg: "15px",
    xl: "18px",
    "2xl": "22px",
    "3xl": "28px",
    "4xl": "36px",
  },

  motion: {
    easeOut: "cubic-bezier(0.2, 0.7, 0.2, 1)",
    easeInOut: "cubic-bezier(0.6, 0, 0.4, 1)",
    fast: "120ms",
    med: "220ms",
    slow: "380ms",
  },
} as const;

export type AppTheme = typeof theme;
