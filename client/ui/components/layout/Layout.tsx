import { styled } from "styled-components";
import { type AppTheme } from "../../theme.ts";

type SpaceKey = keyof AppTheme["space"];

export const VStack = styled.div<{ $gap?: SpaceKey }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme, $gap }) => theme.space[$gap ?? (2 as SpaceKey)]};
`;

export const HStack = styled.div<
  {
    $gap?: SpaceKey;
    $align?: "center";
    $justifyContent?: "space-between" | "flex-end";
  }
>`
  display: flex;
  gap: ${({ theme, $gap }) => theme.space[$gap ?? (2 as SpaceKey)]};
  align-items: ${({ $align }) => $align};
  justify-content: ${({ $justifyContent }) => $justifyContent};
`;

export const HoverHighlight = styled.div`
  color: ${({ theme }) => theme.ink.mid};

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
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
  background-color: ${({ theme }) => theme.surface.scrim};
  pointer-events: auto;
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
