import { styled } from "npm:styled-components";

export const Box = styled.div<
  { $gap: 4 | 8 | 16 | 24 | 32; direction: "vertical" | "horizontal" }
>((
  { $gap: gap = 4, direection = "horizontal" },
) => ({
  display: "flex",
  flexDirection: direection,
  alignItems: "center",
  gap,
}));
