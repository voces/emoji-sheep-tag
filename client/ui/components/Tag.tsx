import { styled } from "styled-components";

export const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 3px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-size: ${({ theme }) => theme.text.xs};
  font-weight: 500;
  letter-spacing: 0.02em;
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  background: ${({ theme }) => theme.surface[2]};
  color: ${({ theme }) => theme.ink.mid};
  line-height: 1;
`;

export const AccentTag = styled(Tag)`
  color: ${({ theme }) => theme.accent.hi};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.accent.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.accent.bg};
`;

export const DangerTag = styled(Tag)`
  color: ${({ theme }) => theme.danger.DEFAULT};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.danger.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.danger.bg};
`;

export const SuccessTag = styled(Tag)`
  color: ${({ theme }) => theme.success.DEFAULT};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.success.DEFAULT} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: ${({ theme }) => theme.success.bg};
`;

export const GoldTag = styled(Tag)`
  color: ${({ theme }) => theme.game.gold};
  border-color: color-mix(
    in oklab,
    ${({ theme }) => theme.game.gold} 35%,
    ${({ theme }) => theme.border.DEFAULT}
  );
  background: color-mix(
    in oklab,
    ${({ theme }) => theme.game.gold} 14%,
    transparent
  );
`;
