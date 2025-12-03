import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { Button } from "@/components/forms/Button.tsx";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { send } from "../../../../client.ts";
import { nonNull } from "@/shared/types.ts";
import {
  ButtonRow,
  DraftContent,
  IconWrapper,
  PhaseIndicator,
  PlayerCard,
  PlayerList,
  PlayerName,
  PoolColumn,
  PoolHeader,
  TeamColumn,
  TeamHeader,
} from "./styles.tsx";

export const Drafting = () => {
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

  const captain0 = players.find((p) => p.id === draft.captains[0]);
  const captain1 = players.find((p) => p.id === draft.captains[1]);
  const team0Players = draft.picks[0]
    .map((id) => players.find((p) => p.id === id))
    .filter(nonNull);
  const team1Players = draft.picks[1]
    .map((id) => players.find((p) => p.id === id))
    .filter(nonNull);

  const allPicked = [...draft.picks[0], ...draft.picks[1]];
  const pool = nonObservers.filter(
    (p) => !draft.captains.includes(p.id) && !allPicked.includes(p.id),
  );

  const currentCaptainId = draft.captains[draft.currentPicker];
  const isMyTurn = localPlayerId === currentCaptainId;

  const handlePick = (playerId: string) => {
    if (!isMyTurn) return;
    send({ type: "captainPick", playerId });
  };

  const handleCancel = () => {
    if (!isHost) return;
    send({ type: "cancelCaptains" });
  };

  return (
    <>
      <PhaseIndicator>
        {isMyTurn
          ? `Your turn to pick (${draft.picksThisTurn} remaining)`
          : `${
            players.find((p) => p.id === currentCaptainId)?.name
          }'s turn to pick`}
      </PhaseIndicator>
      <DraftContent>
        <TeamColumn>
          <TeamHeader>
            <PlayerCard $selected>
              <IconWrapper>
                <SvgIcon
                  icon="sheep"
                  accentColor={captain0?.playerColor ?? undefined}
                />
              </IconWrapper>
              <PlayerName>{captain0?.name}</PlayerName>
              <span>Captain</span>
            </PlayerCard>
            {/* {`${captain0?.name ?? "Captain 1"}'s team`} */}
          </TeamHeader>
          <PlayerList>
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
                    icon="sentry"
                    accentColor={p.playerColor ?? undefined}
                  />
                </IconWrapper>
                <PlayerName>{p.name}</PlayerName>
                {isMyTurn && <Button>Select</Button>}
              </PlayerCard>
            ))}
          </PlayerList>
        </PoolColumn>

        <TeamColumn>
          <TeamHeader>
            {`${captain1?.name ?? "Captain 2"}'s team`}
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
      {isHost && (
        <ButtonRow>
          <Button onClick={handleCancel}>
            Cancel Draft
          </Button>
        </ButtonRow>
      )}
    </>
  );
};
