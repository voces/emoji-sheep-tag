import { styled } from "styled-components";

export const ConflictWarningContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  color: ${({ theme }) => theme.game.orange};
  font-size: ${({ theme }) => theme.text.sm};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  background: ${({ theme }) => theme.danger.bg};
  border-radius: ${({ theme }) => theme.radius.sm};
`;
