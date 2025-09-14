import { styled } from "styled-components";
import { DefaultTheme } from "styled-components";

export const VStack = styled.div<{ $gap?: keyof DefaultTheme["spacing"] }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $gap }) => theme.spacing[$gap ?? "md"]};
`;

export const HStack = styled.div<
  { $gap?: keyof DefaultTheme["spacing"]; $align?: "center" }
>`
  display: flex;
  gap: ${({ theme, $gap }) => theme.spacing[$gap ?? "md"]};
  align-items: ${({ $align }) => $align};
`;

export const HoverHighlight = styled.div`
  color: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 10));

  &:hover,
  &.hover {
    color: ${({ theme }) => theme.colors.body};
  }
`;

export const AbsCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const Overlay = styled.div`
  position: absolute;
  inset: 0;
  background-color: color-mix(
    in oklab,
    ${({ theme }) => theme.colors.border} 40%,
    transparent
  );
  backdrop-filter: blur(3px);
`;

export const Positional = styled.div`
  pointer-events: none;

  > *:not(.positional) {
    pointer-events: auto;
  }
`;

export const HideEmpty = styled.div`
  &:empty {
    display: none;
  }
`;
