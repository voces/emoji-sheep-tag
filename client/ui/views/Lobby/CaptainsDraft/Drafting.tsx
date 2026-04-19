import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { usePlayers } from "@/hooks/usePlayers.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { GoldTag } from "@/components/Tag.tsx";
import { SmallGhostButton } from "@/components/forms/ActionButton.tsx";
import { send } from "../../../../messaging.ts";
import { nonNull } from "@/shared/types.ts";
import {
  ButtonRow,
  DraftColumns,
  PlayerIcon,
  PlayerName,
  PoolLabel,
  PoolPlayer,
  PoolSection,
  TeamColumn,
  TeamHeader,
  TeamLabel,
  TurnBanner,
} from "./styles.tsx";

export const Drafting = () => {
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
  const currentCaptainName =
    players.find((p) => p.id === currentCaptainId)?.name ?? "";

  return (
    <>
      <TurnBanner $isYou={isMyTurn}>
        {isMyTurn
          ? `${t("lobby.yourTurn")} \u2014 ${
            t("lobby.picksRemaining", { count: draft.picksThisTurn })
          }`
          : t("lobby.pickingTurn", { name: currentCaptainName })}
      </TurnBanner>

      <DraftColumns>
        <TeamColumn $active={draft.currentPicker === 0}>
          <TeamHeader>
            {captain0 && (
              <PlayerIcon>
                <SvgIcon
                  icon="sheep"
                  accentColor={captain0.playerColor ?? undefined}
                />
              </PlayerIcon>
            )}
            <TeamLabel>
              {t("lobby.teamOf", { name: captain0?.name })}
            </TeamLabel>
            <GoldTag>{t("lobby.captain")}</GoldTag>
          </TeamHeader>
          {team0Players.map((p) => (
            <PoolPlayer key={p.id} $clickable={false}>
              <PlayerIcon>
                <SvgIcon
                  icon="sheep"
                  accentColor={p.playerColor ?? undefined}
                />
              </PlayerIcon>
              <PlayerName>{p.name}</PlayerName>
            </PoolPlayer>
          ))}
        </TeamColumn>

        <TeamColumn $active={draft.currentPicker === 1}>
          <TeamHeader>
            {captain1 && (
              <PlayerIcon>
                <SvgIcon
                  icon="wolf"
                  accentColor={captain1.playerColor ?? undefined}
                />
              </PlayerIcon>
            )}
            <TeamLabel>
              {t("lobby.teamOf", { name: captain1?.name })}
            </TeamLabel>
            <GoldTag>{t("lobby.captain")}</GoldTag>
          </TeamHeader>
          {team1Players.map((p) => (
            <PoolPlayer key={p.id} $clickable={false}>
              <PlayerIcon>
                <SvgIcon
                  icon="wolf"
                  accentColor={p.playerColor ?? undefined}
                />
              </PlayerIcon>
              <PlayerName>{p.name}</PlayerName>
            </PoolPlayer>
          ))}
        </TeamColumn>
      </DraftColumns>

      {pool.length > 0 && (
        <PoolSection>
          <PoolLabel>{t("lobby.availablePlayers")}</PoolLabel>
          {pool.map((p) => (
            <PoolPlayer
              key={p.id}
              $clickable={isMyTurn}
              onClick={() =>
                isMyTurn && send({ type: "captainPick", playerId: p.id })}
            >
              <PlayerIcon>
                <SvgIcon
                  icon="sentry"
                  accentColor={p.playerColor ?? undefined}
                />
              </PlayerIcon>
              <PlayerName>{p.name}</PlayerName>
            </PoolPlayer>
          ))}
        </PoolSection>
      )}

      {isHost && (
        <ButtonRow>
          <SmallGhostButton
            type="button"
            onClick={() => send({ type: "cancelCaptains" })}
          >
            {t("lobby.cancelDraft")}
          </SmallGhostButton>
        </ButtonRow>
      )}
    </>
  );
};
