import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Player } from "@/shared/api/player.ts";
import { ColorPickerPopup } from "@/components/forms/ColorPicker.tsx";
import { NameInput, NameInputRef } from "@/components/forms/NameInput.tsx";
import { send } from "../../../messaging.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { AccentTag, GoldTag, Tag } from "@/components/Tag.tsx";
import { draftModeVar } from "@/vars/draftMode.ts";
import {
  ArrowRightLeft,
  Crown,
  Eye,
  Gamepad2,
  Palette,
  PenLine,
  Trash2,
  Trophy,
} from "lucide-react";
import { SvgIcon } from "@/components/SVGIcon.tsx";
import { IconTooltip } from "@/components/InfoTooltip.tsx";
import {
  ComputerLabel,
  GoldStatCell,
  KebabButton,
  MenuItem,
  PlayerAvatar,
  PlayerMain,
  PlayerMenu,
  PlayerMenuOverlay,
  PlayerNameCell,
  PlayerRowContainer,
  StatCell,
  StatCellWithIcon,
} from "./Players.styled.ts";

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

export const PlayerRow = ({
  player,
  isLocalPlayer,
  isHost,
  isPlayerHost,
  isCaptain,
  isComputer,
  isBulldog,
  playerRounds,
  bulldogStats,
  hasBestAverage,
  longestRoundTooltip,
}: {
  player: Player;
  isLocalPlayer: boolean;
  isHost: boolean;
  isPlayerHost: boolean;
  isCaptain: boolean;
  isComputer: boolean;
  isBulldog: boolean;
  playerRounds: readonly { duration: number }[];
  bulldogStats: { solo: number; team: number; leaks: number };
  hasBestAverage: boolean;
  longestRoundTooltip: React.ReactNode | null;
}) => {
  const { t } = useTranslation();
  const nameInputRef = useRef<NameInputRef>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <PlayerRowContainer $isWolf={player.team === "wolf"}>
      <PlayerMain ref={buttonRef} $bulldog={isBulldog}>
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
        {isBulldog
          ? (
            <>
              <StatCell>{player.sheepCount ?? 0}</StatCell>
              <StatCell>{bulldogStats.solo}</StatCell>
              <StatCell>{bulldogStats.team}</StatCell>
              <StatCell>{bulldogStats.leaks}</StatCell>
            </>
          )
          : (
            <>
              <StatCell>{player.sheepCount ?? 0}</StatCell>
              {(() => {
                const avg = playerRounds.length
                  ? formatDuration(
                    playerRounds.reduce((sum, r) => sum + r.duration, 0) /
                      playerRounds.length,
                    true,
                  )
                  : "—";
                const crown = longestRoundTooltip && (
                  <IconTooltip
                    icon={Trophy}
                    size={12}
                    content={longestRoundTooltip}
                    color="inherit"
                  />
                );
                const Cell = hasBestAverage ? GoldStatCell : StatCell;
                return crown
                  ? <StatCellWithIcon as={Cell}>{crown}{avg}</StatCellWithIcon>
                  : <Cell>{avg}</Cell>;
              })()}
            </>
          )}
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
