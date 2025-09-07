import { styled } from "npm:styled-components";

export const CommandButton = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  border: 4px outset ${({ theme }) => theme.colors.body};
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.shadow};
  filter: brightness(80%);
  transition: filter 100ms ease-in 100ms;
  cursor: pointer;

  &[aria-pressed="true"] {
    filter: brightness(100%);
    transition: filter 100ms ease-out 0ms;
  }

  &:hover,
  &.hover {
    border-style: inset;
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
