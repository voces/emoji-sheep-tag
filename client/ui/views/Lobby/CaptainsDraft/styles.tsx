import { styled } from "styled-components";
import { Panel } from "@/components/Panel.tsx";

export const DraftPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[4]} 0;
  gap: ${({ theme }) => theme.space[4]};
`;

export const DraftHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

export const DraftTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.ink.hi};
`;

export const PhaseTag = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

export const CaptainSlots = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
`;

export const CaptainSlot = styled.div<{ $filled: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 10px ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px dashed ${({ $filled, theme }) =>
    $filled ? theme.accent.DEFAULT : theme.border.DEFAULT};
  background: ${({ $filled, theme }) =>
    $filled ? theme.accent.bg : theme.surface[0]};
  min-height: 48px;
  transition:
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
`;

export const SlotLabel = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

export const SlotName = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  color: ${({ theme }) => theme.ink.hi};
  flex: 1;
`;

export const PlayerPool = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
`;

export const PoolPlayer = styled.button<{
  $clickable: boolean;
  $selected?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  padding: 8px ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ $selected, theme }) =>
    $selected ? theme.accent.DEFAULT : "transparent"};
  background: ${({ $selected, theme }) =>
    $selected ? theme.accent.bg : theme.surface[2]};
  color: ${({ theme }) => theme.ink.hi};
  font: inherit;
  font-size: ${({ theme }) => theme.text.md};
  text-align: left;
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
  transition:
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};

  &.hover {
    background: ${({ $clickable, theme }) =>
      $clickable ? theme.surface[3] : theme.surface[2]};
    border-color: ${({ $clickable, $selected, theme }) =>
      $selected
        ? theme.accent.DEFAULT
        : $clickable
        ? theme.border.DEFAULT
        : "transparent"};
  }
`;

export const PlayerIcon = styled.div`
  width: 28px;
  height: 28px;
  flex-shrink: 0;
`;

export const PlayerName = styled.span`
  flex: 1;
  font-weight: 500;
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
`;

export const DraftColumns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[3]};
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

export const TeamColumn = styled.div<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.surface[0]};
  border: 1px solid ${({ $active, theme }) =>
    $active ? theme.accent.DEFAULT : theme.border.soft};
  overflow-y: auto;
  min-height: 0;
  transition: border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
`;

export const TeamHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding-bottom: ${({ theme }) => theme.space[2]};
  margin-bottom: ${({ theme }) => theme.space[2]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
`;

export const TeamPlayer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 8px 0;
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  color: ${({ theme }) => theme.ink.hi};
`;

export const TeamLabel = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.hi};
  flex: 1;
`;

export const PoolSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

export const PoolLabel = styled.div`
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.ink.mid};
`;

export const TurnBanner = styled.div<{ $isYou: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ $isYou, theme }) =>
    $isYou ? theme.accent.bg : theme.surface[2]};
  border: 1px solid ${({ $isYou, theme }) =>
    $isYou ? theme.accent.DEFAULT : theme.border.soft};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;
  color: ${({ $isYou, theme }) => $isYou ? theme.accent.hi : theme.ink.mid};
`;
