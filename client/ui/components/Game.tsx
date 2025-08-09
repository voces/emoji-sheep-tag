import { styled } from "npm:styled-components";

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
    text-shadow: 0 0 2px ${({ theme }) => theme.colors.border};
    opacity: 0;
    transition: all 100ms ease-in-out;
    outline: none;
    padding-left: ${({ theme }) => theme.spacing.sm};
    margin-left: -${({ theme }) => theme.spacing.sm};

    &.open {
      opacity: 1;
      background-color: color-mix(
        in oklab,
        ${({ theme }) => theme.colors.background} 70%,
        transparent
      );
      box-shadow: color-mix(in oklab, ${({ theme }) =>
        theme.colors.shadow} 70%, transparent) 1px 1px 4px
        1px;
      }

      &.dismissed {
        opacity: 0.5;
        background-color: color-mix(
          in oklab,
          ${({ theme }) => theme.colors.background} 20%,
          transparent
        );
        box-shadow: color-mix(in oklab, ${({ theme }) =>
          theme.colors.shadow} 20%, transparent) 1px 1px 4px
          1px;
        }
      }
    `;

    export const CommandPalette = styled.div`
      position: absolute;
      top: 20px;
      width: 400px;
      left: calc(50% - 200px);
      opacity: 0;
      transition: all 100ms ease-in-out;
      pointer-events: none;

      &.open {
        opacity: 1;
        pointer-events: initial;
      }

      > div.hover,
      > div:has(.hover) {
        background-color: ${({ theme }) => theme.colors.shadow};
        margin: 0 - ${({ theme }) => theme.spacing.lg};
        padding: 0 ${({ theme }) => theme.spacing.lg};
      }

      > div > div:nth-of-type(2) {
        font-size: 70%;
        color: color-mix(in oklab, ${({ theme }) =>
          theme.colors.body} 70%, transparent);
      }

      .focused {
        background-color: ${({ theme }) => theme.colors.shadow};
        margin: 0 - ${({ theme }) => theme.spacing.lg};
        padding: 0 ${({ theme }) => theme.spacing.lg};
      }
    `;

    export const Highlight = styled.span`
      color: color-mix(
        in oklab,
        ${({ theme }) => theme.colors.body} 30%,
        ${({ theme }) => theme.colors.primary}
      );
    `;

    export const Tooltip = styled.div`
      position: fixed;
      background-color: ${({ theme }) => theme.colors.background};
      box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
      padding: ${({ theme }) => theme.spacing.lg};
      transform: translate(-50%, -100%);
      padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
        theme.spacing.md};
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
    `;
