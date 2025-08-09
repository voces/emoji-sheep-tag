import { styled } from "npm:styled-components";

export const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
  box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const CardHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
  font-weight: bold;
`;

export const CardContent = styled.div`
  /* Content styling */
`;