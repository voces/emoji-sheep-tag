import { styled } from "styled-components";

export const TextInput = styled.input`
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 7px 10px;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.sm};
  min-height: 30px;
  width: 100%;
  outline: none;
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.hi};
  }

  &:focus {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.accent.bg};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

export const MonoInput = styled(TextInput)`
  font-family: ${({ theme }) => theme.font.mono};
  letter-spacing: 0.02em;
`;
