import { keyframes, styled } from "styled-components";

const marchingAnts = keyframes`
  0% { background-position: 0 0, 100% 0, 100% 100%, 0 100%; }
  100% { background-position: 12px 0, 100% 12px, calc(100% - 12px) 100%, 0 calc(100% - 12px); }
`;

export const CommandButton = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &[aria-pressed="true"] {
    background: ${({ theme }) => theme.surface[3]};
    border-color: ${({ theme }) => theme.accent.DEFAULT};
  }

  &[aria-disabled="true"] {
    opacity: 0.4;
  }

  &.hover[role="button"]:not([aria-disabled="true"]):not([data-autocast]) {
    background: ${({ theme }) => theme.surface[3]};
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    transform: translateY(-1px);
  }

  &[data-autocast] {
    border: 1px dashed ${({ theme }) => theme.game.gold};
  }

  &[data-autocast="enabled"] {
    border-color: transparent;
  }
  &[data-autocast="enabled"]::before {
    content: "";
    position: absolute;
    inset: -2px;
    background:
      repeating-linear-gradient(90deg, gold 0 6px, transparent 6px 10px),
      repeating-linear-gradient(180deg, gold 0 6px, transparent 6px 10px),
      repeating-linear-gradient(90deg, gold 0 6px, transparent 6px 10px),
      repeating-linear-gradient(180deg, gold 0 6px, transparent 6px 10px);
    background-size: 100% 2px, 2px 100%, 100% 2px, 2px 100%;
    background-position: 0 0, 100% 0, 100% 100%, 0 100%;
    background-repeat: no-repeat;
    animation: ${marchingAnts} 0.4s linear infinite;
    pointer-events: none;
    border-radius: inherit;
  }
`;

const CommandBadge = styled.span`
  position: absolute;
  bottom: 2px;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 9px;
  background: ${({ theme }) => theme.surface[0]};
  border-radius: 2px;
  padding: 0 3px;
  line-height: 14px;
  height: 14px;
  letter-spacing: 0.02em;
`;

export const CommandShortcut = styled(CommandBadge).attrs({ as: "kbd" })`
  right: 2px;
  color: ${({ theme }) => theme.ink.mid};

  [aria-disabled="true"] > & {
    color: ${({ theme }) => theme.ink.mute};
  }
`;

export const CommandCount = styled(CommandBadge)`
  left: 2px;
  color: ${({ theme }) => theme.ink.hi};
`;
