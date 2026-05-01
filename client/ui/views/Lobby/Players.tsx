import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { send } from "../../../messaging.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import {
  Segment,
  SegmentedControl,
} from "@/components/forms/SegmentedControl.tsx";
import { SmallButton } from "@/components/forms/ActionButton.tsx";
import { useShakeError } from "@/components/ShakeError.tsx";
import {
  DangerSmallButton,
  InlineConfirmBar,
} from "@/components/InlineConfirm.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { draftModeVar } from "@/vars/draftMode.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { Chat } from "./Chat.tsx";
import { PlayerRow } from "./PlayerRow.tsx";
import { usePlayerStats } from "./usePlayerStats.ts";
import {
  ListHeader,
  PlayerList,
  PlayersPanel,
  SectionHead,
  SectionSub,
  SectionTitle,
} from "./Players.styled.ts";

export const Players = () => {
  const { t } = useTranslation();
  const players = usePlayers();
  const localPlayer = useLocalPlayer();
  const rounds = useReactiveVar(roundsVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const captainsDraft = useReactiveVar(captainsDraftVar);

  useListenToEntities(players, [
    "playerColor",
    "name",
    "team",
    "sheepCount",
    "isComputer",
  ]);

  const isHost = localPlayer?.id === lobbySettings.host;
  const isBulldog = lobbySettings.mode === "bulldog";
  const captains = captainsDraft?.captains;
  const draftMode = useReactiveVar(draftModeVar);
  const isCaptainsPhase = captainsDraft?.phase === "drafted" ||
    captainsDraft?.phase === "reversed";
  const [pendingMode, setPendingMode] = useState<"manual" | "smart" | null>(
    null,
  );
  const nonObserverCount = players.filter((p) => p.team !== "observer").length;
  const {
    ref: captainsRef,
    showError: showCaptainsError,
    errorBubble: captainsErrorBubble,
    Wrapper: ShakeWrapper,
  } = useShakeError();

  const handleModeSwitch = (mode: "manual" | "smart") => {
    if (isCaptainsPhase) {
      setPendingMode(mode);
      return;
    }
    draftModeVar(mode);
    // Smart→Manual locks in the current team composition. Only override the
    // sheep setting if its resolved value diverges from reality; if auto
    // already matches, leave it as auto so it keeps adapting.
    if (mode === "manual") {
      const actualSheep = players.filter((p) => p.team === "sheep").length;
      if (actualSheep > 0 && actualSheep !== lobbySettings.sheep) {
        send({ type: "lobbySettings", sheep: actualSheep });
      }
    }
  };

  const confirmExit = () => {
    if (!pendingMode) return;
    send({ type: "cancelCaptains" });
    draftModeVar(pendingMode);
    setPendingMode(null);
  };

  const {
    playerRoundsMap,
    bestAverageIds,
    longestRoundIds,
    longestRoundByPlayer,
    bulldogStats,
  } = usePlayerStats(players, rounds);

  return (
    <PlayersPanel>
      <SectionHead>
        <div>
          <SectionTitle>{t("lobby.players")}</SectionTitle>
          {(() => {
            const sc = players.filter((p) => p.team === "sheep").length;
            const wc = players.filter((p) => p.team === "wolf").length;
            return (
              <SectionSub>
                {sc} {t("lobby.sheep", { count: sc })} · {wc}{" "}
                {t("lobby.wolf", { count: wc })}
              </SectionSub>
            );
          })()}
        </div>
        {isHost && (pendingMode
          ? (
            <InlineConfirmBar>
              {t("lobby.exitCaptains")}
              <DangerSmallButton type="button" onClick={confirmExit}>
                {t("lobby.exitCaptainsConfirm")}
              </DangerSmallButton>
              <SmallButton
                type="button"
                onClick={() => setPendingMode(null)}
              >
                {t("settings.cancel")}
              </SmallButton>
            </InlineConfirmBar>
          )
          : (
            <SegmentedControl>
              <Segment
                $active={draftMode === "manual" && !isCaptainsPhase}
                onClick={() => handleModeSwitch("manual")}
                title={t("lobby.manualTooltip")}
              >
                {t("lobby.manual")}
              </Segment>
              <ShakeWrapper ref={captainsRef}>
                <Segment
                  $active={isCaptainsPhase}
                  onClick={() => {
                    if (isCaptainsPhase) return;
                    if (nonObserverCount < 4) {
                      showCaptainsError(t("lobby.needMoreForCaptains"));
                      return;
                    }
                    send({ type: "startCaptains" });
                  }}
                  disabled={isCaptainsPhase}
                  title={nonObserverCount < 4
                    ? t("lobby.needMoreForCaptains")
                    : t("lobby.captainsTooltip")}
                >
                  {t("lobby.captains")}
                </Segment>
              </ShakeWrapper>
              {captainsErrorBubble}
              <Segment
                $active={draftMode === "smart" && !isCaptainsPhase}
                onClick={() => handleModeSwitch("smart")}
                title={t("lobby.smartDraftTooltip")}
              >
                {t("lobby.smartDraft")}
              </Segment>
            </SegmentedControl>
          ))}
      </SectionHead>

      <PlayerList>
        <ListHeader $bulldog={isBulldog}>
          <span />
          <span>{t("lobby.players")}</span>
          {isBulldog
            ? (
              <>
                <span>{t("lobby.sheepCount")}</span>
                <span title={t("lobby.bulldogSoloTooltip")}>
                  {t("lobby.bulldogSolo")}
                </span>
                <span title={t("lobby.bulldogTeamTooltip")}>
                  {t("lobby.bulldogTeam")}
                </span>
                <span title={t("lobby.bulldogLeaksTooltip")}>
                  {t("lobby.bulldogLeaks")}
                </span>
              </>
            )
            : (
              <>
                <span>{t("lobby.sheepCount")}</span>
                <span>{t("lobby.averageTime")}</span>
              </>
            )}
          <span />
        </ListHeader>
        {players.map((p) => {
          const hasLongest = longestRoundIds.has(p.id);
          const longest = hasLongest
            ? longestRoundByPlayer.get(p.id)
            : undefined;
          const tooltipContent = longest
            ? (
              <div>
                <div>
                  {t("lobby.longestRound", {
                    duration: formatDuration(longest.duration, true),
                  })}
                </div>
                <div style={{ marginTop: 4 }}>
                  {longest.sheep.map((sid) => {
                    const sp = players.find((pl) => pl.id === sid);
                    return (
                      <span
                        key={sid}
                        style={{
                          color: sp?.playerColor ?? undefined,
                          marginRight: 6,
                        }}
                      >
                        {sp?.name ?? sid}
                      </span>
                    );
                  })}
                </div>
              </div>
            )
            : null;
          return (
            <PlayerRow
              key={p.id}
              player={p}
              isLocalPlayer={p.id === localPlayer?.id}
              isHost={isHost}
              isPlayerHost={p.id === lobbySettings.host}
              isCaptain={captains?.includes(p.id) ?? false}
              isComputer={p.isComputer ?? false}
              isBulldog={isBulldog}
              playerRounds={playerRoundsMap.get(p.id) ?? []}
              bulldogStats={bulldogStats.get(p.id) ??
                { solo: 0, team: 0, leaks: 0 }}
              hasBestAverage={bestAverageIds.has(p.id)}
              longestRoundTooltip={tooltipContent}
            />
          );
        })}
      </PlayerList>

      <Chat />
    </PlayersPanel>
  );
};
