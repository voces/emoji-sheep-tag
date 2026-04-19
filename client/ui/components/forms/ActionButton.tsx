import { css, styled } from "styled-components";

const base = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  min-height: 36px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  letter-spacing: 0.005em;
  transition:
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
  user-select: none;
  white-space: nowrap;
  cursor: pointer;

  &.hover {
    background: ${({ theme }) => theme.surface[3]};
    border-color: ${({ theme }) => theme.border.hi};
  }

  &.active {
    transform: translateY(1px);
  }

  &:disabled,
  &[aria-disabled="true"] {
    opacity: 0.45;
    pointer-events: none;
  }
`;

export const ActionButton = styled.button`
  ${base};
`;

export const PrimaryButton = styled.button`
  ${base} background: ${({ theme }) => theme.accent.DEFAULT};
  color: ${({ theme }) => theme.accent.ink};
  border-color: ${({ theme }) => theme.accent.DEFAULT};
  font-weight: 600;

  &.hover {
    background: ${({ theme }) => theme.accent.hi};
    border-color: ${({ theme }) => theme.accent.hi};
  }
`;

export const GhostButton = styled.button`
  ${base} background: transparent;
  border-color: transparent;
  color: ${({ theme }) => theme.ink.mid};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

export const SmallButton = styled(ActionButton)`
  min-height: 28px;
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

export const SmallGhostButton = styled(GhostButton)`
  min-height: 28px;
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.text.sm};
  border-radius: ${({ theme }) => theme.radius.sm};
`;

export const LargePrimaryButton = styled(PrimaryButton)`
  min-height: 44px;
  padding: 12px 20px;
  font-size: ${({ theme }) => theme.text.lg};
`;
