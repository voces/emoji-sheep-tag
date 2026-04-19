import { styled } from "styled-components";

export const IconButton = styled.button`
  background: transparent;
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.space[1]};
  cursor: pointer;
  color: ${({ theme }) => theme.ink.mid};
  opacity: var(--icon-button-opacity, 0.5);
  transition:
    opacity ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.text.xl};
  min-width: 28px;
  min-height: 28px;

  &.hover {
    opacity: 1;
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
  }

  &.active {
    opacity: 1;
    color: ${({ theme }) => theme.ink.hi};
  }
`;
