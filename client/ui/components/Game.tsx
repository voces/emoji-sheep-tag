import { styled } from "styled-components";

// Game-specific styled components for UI elements that need global styling

export const UIContainer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
`;

export const CursorElement = styled.svg`
  position: absolute;
  width: 24px;
  height: 24px;
  z-index: 1;
  pointer-events: none;
  transform: scaleX(-1);
  visibility: hidden;

  &.entity {
    filter: hue-rotate(90deg);
  }
`;

export const ChatOverlay = styled.div`
  position: absolute;
  bottom: 130px;
  left: 20px;
  pointer-events: none;

  > div {
    opacity: 1;
    animation: fadeOut 3s ease forwards;
    animation-delay: 7s;
  }

  > input {
    background: transparent;
    color: inherit;
    text-shadow: 0 0 2px ${({ theme }) => theme.surface[0]};
    opacity: 0;
    transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeInOut};
    outline: none;
    padding-left: ${({ theme }) => theme.space[1]};
    margin-left: -${({ theme }) => theme.space[1]};

    &.open {
      opacity: 1;
      background-color: color-mix(
        in oklab,
        ${({ theme }) => theme.surface[2]} 70%,
        transparent
      );
      box-shadow: ${({ theme }) => theme.shadow.sm};
    }

    &.dismissed {
      opacity: 0.5;
      background-color: color-mix(
        in oklab,
        ${({ theme }) => theme.surface[2]} 20%,
        transparent
      );
      box-shadow: ${({ theme }) => theme.shadow.sm};
    }
  }
`;

export const Highlight = styled.span`
  color: ${({ theme }) => theme.accent.DEFAULT};
`;

export const Tooltip = styled.div`
  position: fixed;
  background-color: ${({ theme }) => theme.surface[1]};
  box-shadow: ${({ theme }) => theme.shadow.md};
  transform: translate(-50%, -100%);
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
`;
