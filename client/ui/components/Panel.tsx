import { styled } from "styled-components";

export const Panel = styled.div`
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.md}, ${({ theme }) =>
    theme.shadow.inset};
`;
