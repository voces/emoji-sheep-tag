import { styled } from "styled-components";
import { Panel } from "@/components/Panel.tsx";

export const PlayersPanel = styled(Panel)`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[4]} 0;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

export const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
`;

export const SectionSub = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

export const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  min-width: 0;
  padding-right: 4px;
`;

export const PlayerRowContainer = styled.div<{ $isWolf: boolean }>`
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  ${({ $isWolf, theme }) =>
    $isWolf &&
    `border-left: 3px solid color-mix(in oklab, ${theme.danger.DEFAULT} 60%, ${
      theme.surface[2]
    });`} &.hover {
    border-color: ${({ theme }) => theme.border.soft};
  }
`;

export const PlayerMain = styled.div<{ $bulldog: boolean }>`
  display: grid;
  grid-template-columns: ${({ $bulldog }) =>
    $bulldog
      ? "auto minmax(0, 1fr) 82px 64px 64px 64px 40px"
      : "auto minmax(0, 1fr) 110px 110px 40px"};
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  min-width: 0;
  cursor: pointer;

  &.hover {
    background: ${({ theme }) => theme.surface[3]};
  }
`;

export const KebabButton = styled.button`
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  justify-self: end;
  background: transparent;
  border: none;
  border-radius: ${({ theme }) => theme.radius.xs};
  color: ${({ theme }) => theme.ink.mute};
  font-size: ${({ theme }) => theme.text.lg};
  line-height: 1;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
    background: ${({ theme }) => theme.surface[2]};
  }
`;

export const PlayerAvatar = styled.span<{ $team: string }>`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: ${({ $team, theme }) =>
    $team === "wolf"
      ? `color-mix(in oklab, ${theme.danger.DEFAULT} 10%, ${theme.surface[0]})`
      : theme.surface[0]};
  border: 1px solid ${({ $team, theme }) =>
    $team === "wolf"
      ? `color-mix(in oklab, ${theme.danger.DEFAULT} 30%, ${theme.border.DEFAULT})`
      : theme.border.DEFAULT};
  border-radius: 50%;
  overflow: hidden;
  color: ${({ $team, theme }) =>
    $team === "wolf"
      ? `color-mix(in oklab, ${theme.danger.DEFAULT} 60%, #5a3517)`
      : theme.wool.DEFAULT};
`;

export const PlayerNameCell = styled.span`
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 500;
  color: ${({ theme }) => theme.ink.hi};
  display: flex;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  align-items: center;
`;

export const ListHeader = styled.div<{ $bulldog: boolean }>`
  display: grid;
  grid-template-columns: ${({ $bulldog }) =>
    $bulldog
      ? "36px minmax(0, 1fr) 82px 64px 64px 64px 40px"
      : "36px minmax(0, 1fr) 110px 110px 40px"};
  gap: ${({ theme }) => theme.space[2]};
  padding: 4px 12px;
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
  flex-shrink: 0;

  & > span:nth-child(n+3) {
    text-align: right;
  }
`;

export const StatCell = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.lo};
  font-family: ${({ theme }) => theme.font.mono};
  font-variant-numeric: tabular-nums;
  text-align: right;
`;

export const GoldStatCell = styled(StatCell)`
  color: ${({ theme }) => theme.game.gold};
  font-weight: 600;
`;

export const StatCellWithIcon = styled(StatCell)`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`;

export const PlayerMenuOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
`;

export const PlayerMenu = styled.div`
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.lg};
  padding: ${({ theme }) => theme.space[1]};
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

export const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.ink.mid};
  padding: 6px ${({ theme }) => theme.space[2]};
  border-radius: ${({ theme }) => theme.radius.xs};
  font-size: ${({ theme }) => theme.text.sm};
  text-align: left;
  cursor: pointer;
  width: 100%;
  transition: background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
    color: ${({ theme }) => theme.ink.hi};
  }
`;

export const ComputerLabel = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.xs};
`;
