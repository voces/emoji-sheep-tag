import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { Button } from "@/components/forms/Button.tsx";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { send } from "../../../../client.ts";
import {
  ButtonRow,
  IconWrapper,
  PhaseIndicator,
  PlayerCard,
  PlayerList,
  PlayerName,
} from "./styles.tsx";

export const SelectingCaptains = () => {
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

  const handleSelectCaptain = (playerId: string) => {
    if (!isHost) return;
    send({ type: "selectCaptain", playerId });
  };

  const handleRandomCaptains = () => {
    if (!isHost) return;
    send({ type: "randomCaptains" });
  };

  const handleCancel = () => {
    if (!isHost) return;
    send({ type: "cancelCaptains" });
  };

  return (
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
              $selected={isSelected}
              $clickable={isHost}
              onClick={() => handleSelectCaptain(p.id)}
            >
              <IconWrapper>
                <SvgIcon
                  icon="sheep"
                  accentColor={p.playerColor ?? undefined}
                />
              </IconWrapper>
              <PlayerName>{p.name}</PlayerName>
              {isSelected
                ? <span>Captain</span>
                : isHost && <Button>Select</Button>}
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
  );
};
