import { styled } from "styled-components";
import { Button } from "./Button.tsx";

export const ToggleGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.xs};
  overflow: hidden;
`;

export const ToggleButton = styled(Button)<{ $active: boolean }>`
  flex: 1 1 auto;
  border-radius: 0;
  border: none;
  background: ${({ $active, theme }) =>
    $active ? theme.accent.DEFAULT : theme.surface[2]};
  color: ${({ $active, theme }) => $active ? theme.accent.ink : theme.ink.hi};

  &:not(:last-child) {
    border-right: 1px solid ${({ theme }) => theme.border.DEFAULT};
  }

  &:disabled {
    background: ${({ $active, theme }) =>
      $active ? theme.surface[3] : theme.surface[1]};
    color: ${({ theme }) => theme.ink.mute};
  }
`;
