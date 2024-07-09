import { DefaultTheme, styled } from "npm:styled-components";

interface GlossyButtonProps {
  color: keyof DefaultTheme["colors"];
}

export const getTransparentColor = (color: string, transparency: number) =>
  color.replace(")", `, ${transparency})`).replace("rgb", "rgba").replace(
    /^(#[0-9a-f]{6})$/,
    `$1${Math.round(transparency * 255).toString(16).padStart(2, "0")}`,
  );

export const getBoxShadow = (
  theme: DefaultTheme,
  color: keyof DefaultTheme["colors"],
  size = 4,
  inset = true,
) => `
  ${inset ? "inset" : ""} 0 ${size}px ${size * 1.5}px rgba(255, 255, 255, 0.3),
  ${inset ? "inset" : ""} 0 -${size * (inset ? 1 : 0)}px ${
  size * 1.5
}px rgba(0, 0, 0, 0.2),
  0 ${size * 1.25}px ${getTransparentColor(theme.colors[color], 0.6)}
`;

export const Card = styled.div<GlossyButtonProps>((
  { theme, color = "blue" },
) => ({
  background: `linear-gradient(145deg, ${
    getTransparentColor(theme.colors[color], 0.9)
  }, ${getTransparentColor(theme.colors[color], 0.6)})`,
  border: "none",
  borderRadius: 50,
  padding: 24,
  boxShadow: getBoxShadow(theme, color),
  position: "relative",
  overflow: "hidden",
  transition: "all 0.2s ease",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0))",
    borderRadius: 50,
    opacity: 0.7,
    pointerEvents: "none",
  },
}));
