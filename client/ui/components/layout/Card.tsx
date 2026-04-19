import { styled } from "styled-components";

export const Card = styled.div`
  background-color: ${({ theme }) => theme.surface[1]};
  box-shadow: ${({ theme }) => theme.shadow.md};
  padding: ${({ theme }) => theme.space[4]};
`;
