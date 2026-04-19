import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { Player } from "@/shared/api/player.ts";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { ColorPickerPopup } from "@/components/forms/ColorPicker.tsx";
import { NameInput, NameInputRef } from "@/components/forms/NameInput.tsx";
import { send } from "../../../messaging.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { Panel } from "@/components/Panel.tsx";
import { AccentTag, GoldTag, Tag } from "@/components/Tag.tsx";
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
import {
  ArrowRightLeft,
  Crown,
  Eye,
  Gamepad2,
  Palette,
  PenLine,
  Trash2,
} from "lucide-react";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { Chat } from "./Chat.tsx";

const PlayersPanel = styled(Panel)`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[4]} 0;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.border.soft};
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const SectionSub = styled.span`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
`;

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  min-width: 0;
  padding-right: 4px;
`;

const PlayerRowContainer = styled.div<{ $isWolf: boolean }>`
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

const PlayerMain = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 110px 110px 40px;
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

const KebabButton = styled.button`
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

const PlayerAvatar = styled.span<{ $team: string }>`
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

const PlayerNameCell = styled.span`
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

const ListHeader = styled.div`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 110px 110px 40px;
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

const StatCell = styled.span`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.lo};
  font-family: ${({ theme }) => theme.font.mono};
  font-variant-numeric: tabular-nums;
  text-align: right;
`;

const PlayerMenuOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
`;

const PlayerMenu = styled.div`
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

const MenuItem = styled.button`
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

const ComputerLabel = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  font-size: ${({ theme }) => theme.text.xs};
`;

const getTeamIcon = (team: Player["team"]) => {
  switch (team) {
    case "sheep":
      return "sheep";
    case "wolf":
      return "wolf";
    default:
      return "sentry";
  }
};

const PlayerRow = ({
  player,
  isLocalPlayer,
  isHost,
  isPlayerHost,
  isCaptain,
  isComputer,
  playerRounds,
}: {
  player: Player;
  isLocalPlayer: boolean;
  isHost: boolean;
  isPlayerHost: boolean;
  isCaptain: boolean;
  isComputer: boolean;
  playerRounds: readonly { duration: number }[];
}) => {
  const { t } = useTranslation();
  const nameInputRef = useRef<NameInputRef>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const canEdit = isLocalPlayer || isHost;
  const teamIcon = getTeamIcon(player.team);

  const handleTeamChange = (team: "sheep" | "wolf" | "observer" | "auto") => {
    send({
      type: "generic",
      event: {
        type: "teamChange",
        team,
        playerId: isLocalPlayer ? undefined : player.id,
      },
    });
    if (isHost && (team === "sheep" || team === "wolf")) {
      draftModeVar("manual");
    }
    setMenuOpen(false);
  };

  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <PlayerRowContainer $isWolf={player.team === "wolf"}>
      <PlayerMain ref={buttonRef}>
        <PlayerAvatar $team={player.team ?? "sheep"}>
          <div style={{ width: 22, height: 22 }}>
            <SvgIcon
              icon={teamIcon}
              accentColor={player.playerColor ?? undefined}
            />
          </div>
        </PlayerAvatar>
        <PlayerNameCell>
          {isComputer
            ? (
              <>
                <span>{player.name ?? ""}</span>
                <ComputerLabel>
                  &nbsp;({t("lobby.cpu")})
                </ComputerLabel>
              </>
            )
            : (
              <NameInput
                ref={nameInputRef}
                value={player.name ?? ""}
                onChange={(e) =>
                  send({
                    type: "generic",
                    event: { type: "nameChange", name: e },
                  })}
                readonly={!isLocalPlayer}
              />
            )}
          {isLocalPlayer && (
            <AccentTag style={{ marginLeft: 8 }}>{t("lobby.you")}</AccentTag>
          )}
          {isPlayerHost && (
            <Tag style={{ marginLeft: 6 }}>{t("lobby.host")}</Tag>
          )}
          {isCaptain && (
            <GoldTag style={{ marginLeft: 6 }}>
              {t("lobby.captain")}
            </GoldTag>
          )}
        </PlayerNameCell>
        <StatCell>{player.sheepCount ?? 0}</StatCell>
        <StatCell>
          {playerRounds.length
            ? formatDuration(
              playerRounds.reduce((sum, r) => sum + r.duration, 0) /
                playerRounds.length,
              true,
            )
            : "\u2014"}
        </StatCell>
        {canEdit
          ? (
            <KebabButton
              ref={menuButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(true);
              }}
              aria-label={t("lobby.playerActions")}
            >
              ⋮
            </KebabButton>
          )
          : <span />}
      </PlayerMain>

      {menuOpen && menuButtonRef.current && createPortal(
        (() => {
          const rect = menuButtonRef.current!.getBoundingClientRect();
          return (
            <>
              <PlayerMenuOverlay onClick={() => setMenuOpen(false)} />
              <PlayerMenu
                style={{
                  top: rect.bottom + 4,
                  right: globalThis.innerWidth - rect.right,
                }}
              >
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    setColorPickerOpen(true);
                  }}
                >
                  <Palette size={14} /> {t("lobby.changeColor")}
                </MenuItem>
                {isLocalPlayer && (
                  <MenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      nameInputRef.current?.startEditing();
                    }}
                  >
                    <PenLine size={14} /> {t("lobby.changeName")}
                  </MenuItem>
                )}
                {isHost && (
                  <>
                    {player.team !== "sheep" && (
                      <MenuItem onClick={() => handleTeamChange("sheep")}>
                        <ArrowRightLeft size={14} /> {t("lobby.setTeamSheep")}
                      </MenuItem>
                    )}
                    {player.team !== "wolf" && (
                      <MenuItem onClick={() => handleTeamChange("wolf")}>
                        <ArrowRightLeft size={14} /> {t("lobby.setTeamWolf")}
                      </MenuItem>
                    )}
                    {player.team !== "observer" && !isComputer && (
                      <MenuItem onClick={() => handleTeamChange("observer")}>
                        <Eye size={14} /> {t("lobby.setTeamObserver")}
                      </MenuItem>
                    )}
                    {!isLocalPlayer && !isComputer && (
                      <MenuItem
                        onClick={() => {
                          send({
                            type: "generic",
                            event: {
                              type: "transferHost",
                              playerId: player.id,
                            },
                          });
                          setMenuOpen(false);
                        }}
                      >
                        <Crown size={14} /> {t("lobby.transferHost")}
                      </MenuItem>
                    )}
                    {isComputer && (
                      <MenuItem
                        onClick={() => {
                          send({
                            type: "computer",
                            event: { type: "remove", computerId: player.id },
                          });
                          setMenuOpen(false);
                        }}
                      >
                        <Trash2 size={14} /> {t("lobby.removeComputer")}
                      </MenuItem>
                    )}
                  </>
                )}
                {isLocalPlayer && !isHost && (
                  player.team === "observer"
                    ? (
                      <MenuItem onClick={() => handleTeamChange("auto")}>
                        <Gamepad2 size={14} /> {t("lobby.playGame")}
                      </MenuItem>
                    )
                    : (
                      <MenuItem onClick={() => handleTeamChange("observer")}>
                        <Eye size={14} /> {t("lobby.becomeObserver")}
                      </MenuItem>
                    )
                )}
              </PlayerMenu>
            </>
          );
        })(),
        document.body,
      )}

      {colorPickerOpen && menuButtonRef.current && createPortal(
        (() => {
          const rect = menuButtonRef.current!.getBoundingClientRect();
          return (
            <>
              <PlayerMenuOverlay onClick={() => setColorPickerOpen(false)} />
              <div
                style={{
                  position: "fixed",
                  top: rect.bottom + 4,
                  right: globalThis.innerWidth - rect.right,
                  zIndex: 1000,
                }}
              >
                <ColorPickerPopup
                  value={player.playerColor ?? "#FFFFFF"}
                  onChange={(color) =>
                    send({
                      type: "generic",
                      event: {
                        type: "colorChange",
                        color,
                        playerId: isLocalPlayer ? undefined : player.id,
                      },
                    })}
                  onClose={() => setColorPickerOpen(false)}
                />
              </div>
            </>
          );
        })(),
        document.body,
      )}
    </PlayerRowContainer>
  );
};

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
    } else {
      draftModeVar(mode);
    }
  };

  const confirmExit = () => {
    if (!pendingMode) return;
    send({ type: "cancelCaptains" });
    draftModeVar(pendingMode);
    setPendingMode(null);
  };

  const playerRoundsMap = useMemo(() => {
    const sheepCount = players.filter((p) => p.team === "sheep").length;
    const wolfCount = players.filter((p) => p.team === "wolf").length;
    const map = new Map<string, typeof rounds>();
    for (const p of players) {
      map.set(
        p.id,
        rounds.filter((r) =>
          r.sheep.includes(p.id) &&
          r.sheep.length === sheepCount &&
          r.wolves.length === wolfCount
        ),
      );
    }
    return map;
  }, [players, rounds]);

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
        <ListHeader>
          <span />
          <span>{t("lobby.players")}</span>
          <span>{t("lobby.sheepCount")}</span>
          <span>{t("lobby.averageTime")}</span>
          <span />
        </ListHeader>
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            isLocalPlayer={p.id === localPlayer?.id}
            isHost={isHost}
            isPlayerHost={p.id === lobbySettings.host}
            isCaptain={captains?.includes(p.id) ?? false}
            isComputer={p.isComputer ?? false}
            playerRounds={playerRoundsMap.get(p.id) ?? []}
          />
        ))}
      </PlayerList>

      <Chat />
    </PlayersPanel>
  );
};
