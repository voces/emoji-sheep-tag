import { styled } from "styled-components";
import { VStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";

export const SettingsCard = styled(Card)`
  width: 40%;
  justify-content: space-between;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const GameSettingsContainer = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.md};
`;

export const SettingsRow = styled(VStack)`
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const SettingsHeader = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: bold;
`;

export const SettingsLabel = styled.label`
  font-size: 12px;
  font-weight: bold;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
`;

export const ModeButton = styled(Button)<{ $active: boolean }>`
  flex: 1;
  border-radius: 0;
  border: none;
  background: ${({ $active, theme }) =>
    $active
      ? theme.colors.body
      : `hsl(from ${theme.colors.body} h s calc(l - 20))`};

  &:not(:last-child) {
    border-right: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:disabled {
    background: ${({ $active, theme }) =>
      $active
        ? `hsl(from ${theme.colors.body} h s calc(l - 20))`
        : `hsl(from ${theme.colors.body} h s calc(l - 30))`};
  }
`;
