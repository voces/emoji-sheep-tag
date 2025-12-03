import { styled } from "styled-components";
import { Card } from "@/components/layout/Card.tsx";

export const DraftContainer = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  flex: 1;
  overflow: auto;
`;

export const DraftHeader = styled.div`
  font-size: 1.1em;
  font-weight: bold;
  text-align: center;
`;

export const DraftContent = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  flex: 1;
  min-height: 0;
`;

export const TeamColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius};
  transition: background 200ms ease;
`;

export const TeamHeader = styled.div`
  font-weight: bold;
  text-align: center;
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const PoolColumn = styled.div`
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const PoolHeader = styled.div`
  font-weight: bold;
  text-align: center;
`;

export const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  flex: 1;
  overflow: auto;
`;

export const PlayerCard = styled.div<{
  $selected?: boolean;
  $clickable?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
  opacity: ${({ $selected, $clickable }) =>
    $selected ? 1 : $clickable ? 0.8 : 0.7};
  transition: opacity 100ms ease;

  &.hover {
    opacity: ${({ $selected, $clickable }) =>
      $selected || $clickable ? 1 : 0.7};
  }
`;

export const PlayerName = styled.span`
  flex: 1;
  text-align: left;
`;

export const IconWrapper = styled.div`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: center;
`;

export const PhaseIndicator = styled.div`
  text-align: center;
  font-style: italic;
  opacity: 0.8;
`;
