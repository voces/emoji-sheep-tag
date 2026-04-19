import { styled } from "styled-components";
import { SmallButton } from "@/components/forms/ActionButton.tsx";

export const InlineConfirmBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.danger.DEFAULT};
`;

export const DangerSmallButton = styled(SmallButton)`
  color: ${({ theme }) => theme.danger.DEFAULT};
  border-color: ${({ theme }) => theme.danger.DEFAULT};

  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.danger.bg};
    border-color: ${({ theme }) => theme.danger.DEFAULT};
  }
`;
