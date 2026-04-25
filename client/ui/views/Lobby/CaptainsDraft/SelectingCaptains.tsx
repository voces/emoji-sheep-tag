import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { GoldTag } from "@/components/Tag.tsx";
import { send } from "../../../../messaging.ts";
import {
  CaptainSlot,
  CaptainSlots,
  PhaseTag,
  PlayerIcon,
  PlayerName,
  PlayerPool,
  PoolPlayer,
  SlotLabel,
  SlotName,
} from "./styles.tsx";

export const SelectingCaptains = () => {
  const { t } = useTranslation();
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

  const captain0 = draft.captains[0]
    ? players.find((p) => p.id === draft.captains[0])
    : null;
  const captain1 = draft.captains[1]
    ? players.find((p) => p.id === draft.captains[1])
    : null;

  const remaining = 2 - draft.captains.length;

  return (
    <>
      <PhaseTag>
        {isHost
          ? remaining === 2
            ? t("lobby.selectCaptains")
            : t("lobby.selectCaptain1")
          : t("lobby.waitingForCaptains")}
      </PhaseTag>

      <CaptainSlots>
        <CaptainSlot $filled={!!captain0}>
          {captain0
            ? (
              <>
                <PlayerIcon>
                  <SvgIcon
                    icon="sheep"
                    accentColor={captain0.playerColor ?? undefined}
                  />
                </PlayerIcon>
                <SlotName>{captain0.name}</SlotName>
                <GoldTag>{t("lobby.captain")}</GoldTag>
              </>
            )
            : <SlotLabel>{t("lobby.captain")} 1</SlotLabel>}
        </CaptainSlot>
        <CaptainSlot $filled={!!captain1}>
          {captain1
            ? (
              <>
                <PlayerIcon>
                  <SvgIcon
                    icon="wolf"
                    accentColor={captain1.playerColor ?? undefined}
                  />
                </PlayerIcon>
                <SlotName>{captain1.name}</SlotName>
                <GoldTag>{t("lobby.captain")}</GoldTag>
              </>
            )
            : <SlotLabel>{t("lobby.captain")} 2</SlotLabel>}
        </CaptainSlot>
      </CaptainSlots>

      <PlayerPool>
        {nonObservers
          .filter((p) => !draft.captains.includes(p.id))
          .map((p) => (
            <PoolPlayer
              key={p.id}
              $clickable={isHost}
              onClick={() =>
                isHost && send({ type: "selectCaptain", playerId: p.id })}
            >
              <PlayerIcon>
                <SvgIcon
                  icon="sheep"
                  accentColor={p.playerColor ?? undefined}
                />
              </PlayerIcon>
              <PlayerName>{p.name}</PlayerName>
            </PoolPlayer>
          ))}
      </PlayerPool>
    </>
  );
};
