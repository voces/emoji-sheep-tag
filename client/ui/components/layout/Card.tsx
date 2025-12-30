import { styled } from "styled-components";

export const Card = styled.div`
  background-color: ${({ theme }) => theme.colors.background};
  box-shadow: ${({ theme }) => theme.colors.shadow} 1px 1px 4px 1px;
  padding: ${({ theme }) => theme.spacing.lg};
`;
