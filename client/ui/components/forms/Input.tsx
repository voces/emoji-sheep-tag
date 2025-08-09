import { styled } from "npm:styled-components";

export const Input = styled.input`
  border: 0;
  background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 12));
  color: ${({ theme }) => theme.colors.border};
  padding: 0 ${({ theme }) => theme.spacing.sm};

  &.hover:not([disabled]) {
    background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 5));
  }


  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
