import { type DefaultTheme } from "styled-components";

export const theme: DefaultTheme = {
  colors: {
    // Game colors
    pink: "#ff69b4",
    blue: "#1e90ff",
    green: "#32cd32",
    orange: "#ffa500",
    purple: "#9370db",
    gold: "#FFCC00",
    mana: "#5fa7ff",

    // UI colors from CSS vars
    primary: "hsl(202, 86%, 40%)",
    body: "white",
    background: "#333",
    border: "black",
    shadow: "#222",
  },

  spacing: {
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },

  borderRadius: {
    sm: "2px",
    md: "4px",
    lg: "8px",
  },

  shadows: {
    xs: "0 0 1px 1px",
    sm: "1px 1px 1px 2px",
    md: "1px 1px 3px",
    lg: "2px 2px 8px",
  },

  fontSize: {
    sm: "0.875rem",
    md: "1rem",
    lg: "1.2rem",
    xl: "1.5rem",
  },

  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    loose: "1.75",
  },

  fontFamily: {
    sans: '"Trebuchet MS", sans-serif',
  },
};
