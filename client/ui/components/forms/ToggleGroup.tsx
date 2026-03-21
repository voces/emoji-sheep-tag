import { styled } from "styled-components";
import { Button } from "./Button.tsx";

export const ToggleGroup = styled.div`
  display: flex;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 2px;
  overflow: hidden;
`;

export const ToggleButton = styled(Button)<{ $active: boolean }>`
  flex: 1 1 auto;
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
