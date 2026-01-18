import { keyframes, styled } from "styled-components";

const marchingAnts = keyframes`
  0% { background-position: 0 0, 100% 0, 100% 100%, 0 100%; }
  100% { background-position: 12px 0, 100% 12px, calc(100% - 12px) 100%, 0 calc(100% - 12px); }
`;

export const CommandButton = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  border: 4px outset ${({ theme }) => theme.colors.body};
  background-color: ${({ theme }) => theme.colors.shadow};
  filter: brightness(80%);
  transition: filter 100ms ease-in 100ms;

  &[aria-pressed="true"] {
    filter: brightness(100%);
    transition: filter 100ms ease-out 0ms;
  }

  &[aria-disabled="true"] {
    border-color: #bbb;
    filter: saturate(0.3) brightness(0.7);
  }

  &.hover[role="button"]:not([aria-disabled="true"]):not([data-autocast]) {
    border-style: inset;
  }

  &[data-autocast] {
    border: 4px dashed gold;
  }

  &[data-autocast="enabled"] {
    border-color: transparent;
  }
  &[data-autocast="enabled"]::before {
    content: "";
    position: absolute;
    inset: -4px;
    background:
      repeating-linear-gradient(90deg, gold 0 8px, transparent 8px 12px),
      repeating-linear-gradient(180deg, gold 0 8px, transparent 8px 12px),
      repeating-linear-gradient(90deg, gold 0 8px, transparent 8px 12px),
      repeating-linear-gradient(180deg, gold 0 8px, transparent 8px 12px);
    background-size: 100% 4px, 4px 100%, 100% 4px, 4px 100%;
    background-position: 0 0, 100% 0, 100% 100%, 0 100%;
    background-repeat: no-repeat;
    animation: ${marchingAnts} 0.4s linear infinite;
    pointer-events: none;
  }
`;

export const CommandShortcut = styled.kbd`
  position: absolute;
  top: 0;
  right: 2px;
  line-height: 1;
  font-size: 80%;
`;

export const CommandCount = styled.span`
  position: absolute;
  bottom: 0;
  right: 2px;
  line-height: 1;
  font-size: 80%;
`;
