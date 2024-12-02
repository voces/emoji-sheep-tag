import { styled } from "npm:styled-components";
import { getBoxShadow, getTransparentColor } from "./Card.ts";

export const Button = styled.button(({ theme, color = "green" }) => ({
  background: `linear-gradient(145deg, ${
    getTransparentColor(theme.colors[color], 0.9)
  }, ${getTransparentColor(theme.colors[color], 0.6)})`,
  border: "none",
  color: "inherit",
  font: "inherit",
  padding: "16px 20px",
  borderRadius: 25,
  boxShadow: getBoxShadow(theme, color, 3),
  position: "relative",
  transition: "all 0.2s ease",
  "&:hover, &.hover": {
    cursor: "pointer",
    transform: "translateY(-3px)",
  },
  "&:active, &.active": {
    transform: "translateY(2px)",
  },
  "&:focus, &.focus": {
    outline: "none",
    transform: "translateY(-3px)",
    boxShadow: getBoxShadow(theme, color, 3, false),
  },
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0))",
    borderRadius: 25,
    opacity: 0.7,
    pointerEvents: "none",
  },
}));
