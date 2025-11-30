import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { send } from "../../../client.ts";
import { nonNull } from "@/shared/types.ts";

const DraftContainer = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  flex: 1;
  overflow: auto;
`;

const DraftHeader = styled.div`
  font-size: 1.1em;
  font-weight: bold;
  text-align: center;
`;

const DraftContent = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  flex: 1;
  min-height: 0;
`;

const TeamColumn = styled.div<{ $active?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.shadow : "transparent"};
  border-radius: ${({ theme }) => theme.borderRadius};
  transition: background 200ms ease;
`;

const TeamHeader = styled.div`
  font-weight: bold;
  text-align: center;
  padding-bottom: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const PoolColumn = styled.div`
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PoolHeader = styled.div`
  font-weight: bold;
  text-align: center;
`;

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  flex: 1;
  overflow: auto;
`;

const PlayerCard = styled.button<{ $clickable?: boolean; $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) =>
    theme.spacing.md};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.shadow};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};
  opacity: ${({ $clickable, $selected }) => $clickable || $selected ? 1 : 0.7};
  transition: background 100ms ease;

  &.hover {
    background: ${({ theme, $clickable, $selected }) =>
      $clickable && !$selected ? theme.colors.primary : undefined};
  }
`;

const PlayerName = styled.span`
  flex: 1;
  text-align: left;
`;

const IconWrapper = styled.div`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  justify-content: center;
`;

const PhaseIndicator = styled.div`
  text-align: center;
  font-style: italic;
  opacity: 0.8;
`;

export const CaptainsDraft = () => {
  const draft = useReactiveVar(captainsDraftVar);
  const { host } = useReactiveVar(lobbySettingsVar);
  const localPlayerId = useReactiveVar(localPlayerIdVar);
  const players = usePlayers();
  useListenToEntities(players, ["playerColor", "name", "team"]);

  if (!draft) return null;

  const isHost = localPlayerId === host;
  const nonObservers = players.filter(
    (p) => p.team !== "observer" && p.team !== "pending",
  );

  // Get captain and team players
  const captain0 = players.find((p) => p.id === draft.captains[0]);
  const captain1 = players.find((p) => p.id === draft.captains[1]);
  const team0Players = draft.picks[0]
    .map((id) => players.find((p) => p.id === id))
    .filter(nonNull);
  const team1Players = draft.picks[1]
    .map((id) => players.find((p) => p.id === id))
    .filter(nonNull);

  // Get pool (non-captains, non-picked)
  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const pool = nonObservers.filter(
    (p) => !draft.captains.includes(p.id) && !allPicked.includes(p.id),
  );

  const currentCaptainId = draft.captains[draft.currentPicker];
  const isMyTurn = localPlayerId === currentCaptainId;

  const handleSelectCaptain = (playerId: string) => {
    if (!isHost || draft.phase !== "selecting-captains") return;
    send({ type: "selectCaptain", playerId });
  };

  const handleRandomCaptains = () => {
    if (!isHost || draft.phase !== "selecting-captains") return;
    send({ type: "randomCaptains" });
  };

  const handlePick = (playerId: string) => {
    if (!isMyTurn || draft.phase !== "drafting") return;
    send({ type: "captainPick", playerId });
  };

  const handleCancel = () => {
    if (!isHost) return;
    send({ type: "cancelCaptains" });
  };

  return (
    <DraftContainer>
      <DraftHeader>Captains Draft</DraftHeader>

      {draft.phase === "selecting-captains" && (
        <>
          <PhaseIndicator>
            {isHost
              ? `Select ${2 - draft.captains.length} captain${
                draft.captains.length === 1 ? "" : "s"
              }`
              : "Waiting for host to select captains..."}
          </PhaseIndicator>
          <PlayerList>
            {nonObservers.map((p) => {
              const isSelected = draft.captains.includes(p.id);
              return (
                <PlayerCard
                  key={p.id}
                  $clickable={isHost && !isSelected}
                  $selected={isSelected}
                  onClick={() => handleSelectCaptain(p.id)}
                >
                  <IconWrapper>
                    <SvgIcon
                      icon="sheep"
                      accentColor={p.playerColor ?? undefined}
                    />
                  </IconWrapper>
                  <PlayerName>{p.name}</PlayerName>
                  {isSelected && <span>Captain</span>}
                </PlayerCard>
              );
            })}
          </PlayerList>
          <ButtonRow>
            <Button onClick={handleRandomCaptains} disabled={!isHost}>
              Random Captains
            </Button>
            <Button onClick={handleCancel} disabled={!isHost}>
              Cancel
            </Button>
          </ButtonRow>
        </>
      )}

      {draft.phase === "drafting" && (
        <>
          <PhaseIndicator>
            {isMyTurn
              ? `Your turn to pick (${draft.picksThisTurn} remaining)`
              : `${
                players.find((p) => p.id === currentCaptainId)?.name
              }'s turn to pick`}
          </PhaseIndicator>
          <DraftContent>
            <TeamColumn $active={draft.currentPicker === 0}>
              <TeamHeader>
                Sheep - {captain0?.name ?? "Captain 1"}
              </TeamHeader>
              <PlayerList>
                {captain0 && (
                  <PlayerCard $selected>
                    <IconWrapper>
                      <SvgIcon
                        icon="sheep"
                        accentColor={captain0.playerColor ?? undefined}
                      />
                    </IconWrapper>
                    <PlayerName>{captain0.name}</PlayerName>
                    <span>Captain</span>
                  </PlayerCard>
                )}
                {team0Players.map((p) => (
                  <PlayerCard key={p.id}>
                    <IconWrapper>
                      <SvgIcon
                        icon="sheep"
                        accentColor={p.playerColor ?? undefined}
                      />
                    </IconWrapper>
                    <PlayerName>{p.name}</PlayerName>
                  </PlayerCard>
                ))}
              </PlayerList>
            </TeamColumn>

            <PoolColumn>
              <PoolHeader>Available Players</PoolHeader>
              <PlayerList>
                {pool.map((p) => (
                  <PlayerCard
                    key={p.id}
                    $clickable={isMyTurn}
                    onClick={() => handlePick(p.id)}
                  >
                    <IconWrapper>
                      <SvgIcon
                        icon="sheep"
                        accentColor={p.playerColor ?? undefined}
                      />
                    </IconWrapper>
                    <PlayerName>{p.name}</PlayerName>
                  </PlayerCard>
                ))}
              </PlayerList>
            </PoolColumn>

            <TeamColumn $active={draft.currentPicker === 1}>
              <TeamHeader>
                Wolves - {captain1?.name ?? "Captain 2"}
              </TeamHeader>
              <PlayerList>
                {captain1 && (
                  <PlayerCard $selected>
                    <IconWrapper>
                      <SvgIcon
                        icon="wolf"
                        accentColor={captain1.playerColor ?? undefined}
                      />
                    </IconWrapper>
                    <PlayerName>{captain1.name}</PlayerName>
                    <span>Captain</span>
                  </PlayerCard>
                )}
                {team1Players.map((p) => (
                  <PlayerCard key={p.id}>
                    <IconWrapper>
                      <SvgIcon
                        icon="wolf"
                        accentColor={p.playerColor ?? undefined}
                      />
                    </IconWrapper>
                    <PlayerName>{p.name}</PlayerName>
                  </PlayerCard>
                ))}
              </PlayerList>
            </TeamColumn>
          </DraftContent>
          <ButtonRow>
            <Button onClick={handleCancel} disabled={!isHost}>
              Cancel Draft
            </Button>
          </ButtonRow>
        </>
      )}
    </DraftContainer>
  );
};
