import { styled } from "npm:styled-components";

export const Button = styled.button`
  border: 0;
  background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 10));
  color: ${({ theme }) => theme.colors.border};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  
  &:hover:not([disabled]),
  &.hover:not([disabled]) {
    background: ${({ theme }) => theme.colors.body};
    box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  }
  
  &:disabled {
    background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 30));
    color: hsl(from ${({ theme }) => theme.colors.border} h s calc(l + 30));
    cursor: not-allowed;
  }
`;

export const IconButton = styled(Button)`
  width: 2cap;
  height: 2cap;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;