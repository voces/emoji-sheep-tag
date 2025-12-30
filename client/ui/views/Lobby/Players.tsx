import { Fragment, useRef, useState } from "react";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { Player } from "@/shared/api/player.ts";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { ColorPickerPopup } from "@/components/forms/ColorPicker.tsx";
import { NameInput, NameInputRef } from "@/components/forms/NameInput.tsx";
import { send } from "../../../client.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { HStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";
import { SvgIcon } from "@/components/SVGIcon.tsx";

const PlayerMenuButton = styled.button<{ $clickable: boolean }>`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 0;
  filter: ${(
    { $clickable },
  ) => ($clickable ? `drop-shadow(0 0 2px #fff6)` : undefined)};

  &.hover {
    filter: ${(
      { $clickable },
    ) => ($clickable ? `drop-shadow(0 0 2px #fffd)` : undefined)};
  }
`;

const PlayerMenu = styled(Card)`
  position: absolute;
  z-index: 1000;
  min-width: 120px;
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const MenuItem = styled.div`
  background-color: transparent;
  margin: 0;
  padding: 0;
  cursor: pointer;

  &.hover {
    background-color: ${({ theme }) => theme.colors.shadow};
    margin: ${({ theme }) => `0 -${theme.spacing.lg}`};
    padding: 0 ${({ theme }) => theme.spacing.lg};
  }
`;

const PlayerRowContainer = styled(HStack)`
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const CaptainStar = styled.span`
  font-size: 14px;
  line-height: 1;
`;

const PlayersGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  align-items: start;
`;

const GridHeader = styled.div<{ $align?: string }>`
  text-align: ${({ $align }) => $align || "left"};
`;

const PlayersCard = styled(Card)`
  overflow: auto;
  flex: 1;
`;

const PlayerMenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
`;

const getTeamIcon = (team: Player["team"]) => {
  switch (team) {
    case "sheep":
      return "sheep";
    case "wolf":
      return "wolf";
    case "observer":
      return "sentry";
    case "pending":
      return "sentry";
    default:
      return null;
  }
};

type PlayerIconProps = {
  player: Player;
  isLocalPlayer: boolean;
  isHost: boolean;
  nameInputRef: React.RefObject<NameInputRef | null>;
};

const PlayerIcon = (
  { player, isLocalPlayer, isHost, nameInputRef }: PlayerIconProps,
) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const teamIcon = getTeamIcon(player.team);
  const canEdit = isLocalPlayer || isHost;

  const handleClick = () => {
    if (canEdit) {
      setMenuOpen(!menuOpen);
    }
  };

  const handleChangeColor = () => {
    setMenuOpen(false);
    setColorPickerOpen(true);
  };

  const handleColorChange = (color: string) => {
    send({
      type: "generic",
      event: {
        type: "colorChange",
        color,
        playerId: isLocalPlayer ? undefined : player.id,
      },
    });
  };

  const handleTeamChange = (team: "sheep" | "wolf" | "observer" | "auto") => {
    send({
      type: "generic",
      event: {
        type: "teamChange",
        team,
        playerId: isLocalPlayer ? undefined : player.id,
      },
    });
    setMenuOpen(false);
  };

  const handleChangeName = () => {
    setMenuOpen(false);
    nameInputRef.current?.startEditing();
  };

  return (
    <>
      <PlayerMenuButton
        ref={buttonRef}
        $clickable={canEdit}
        onClick={handleClick}
        title={canEdit ? "Click to open menu" : ""}
      >
        {teamIcon && (
          <SvgIcon
            icon={teamIcon}
            accentColor={player.playerColor ?? undefined}
          />
        )}
      </PlayerMenuButton>

      {menuOpen && buttonRef.current && (
        <>
          <PlayerMenuOverlay onClick={() => setMenuOpen(false)} />
          <PlayerMenu
            ref={menuRef}
            style={{
              position: "absolute",
              left: buttonRef.current.offsetLeft,
              top: buttonRef.current.offsetTop +
                buttonRef.current.offsetHeight + 4,
            }}
          >
            <MenuItem onClick={handleChangeColor}>Change color</MenuItem>
            {isLocalPlayer && (
              <MenuItem onClick={handleChangeName}>Change name</MenuItem>
            )}
            {isHost && (
              <>
                {player.team !== "sheep" && (
                  <MenuItem onClick={() => handleTeamChange("sheep")}>
                    Set team: Sheep
                  </MenuItem>
                )}
                {player.team !== "wolf" && (
                  <MenuItem onClick={() => handleTeamChange("wolf")}>
                    Set team: Wolf
                  </MenuItem>
                )}
                {player.team !== "observer" && (
                  <MenuItem onClick={() => handleTeamChange("observer")}>
                    Set team: Observer
                  </MenuItem>
                )}
              </>
            )}
            {isLocalPlayer && !isHost && (
              player.team === "observer"
                ? (
                  <MenuItem onClick={() => handleTeamChange("auto")}>
                    Play game
                  </MenuItem>
                )
                : (
                  <MenuItem onClick={() => handleTeamChange("observer")}>
                    Become observer
                  </MenuItem>
                )
            )}
          </PlayerMenu>
        </>
      )}

      {colorPickerOpen && buttonRef.current && (
        <>
          <PlayerMenuOverlay onClick={() => setColorPickerOpen(false)} />
          <div
            style={{
              position: "absolute",
              left: buttonRef.current.offsetLeft,
              top: buttonRef.current.offsetTop,
              zIndex: 1000,
            }}
          >
            <ColorPickerPopup
              value={player.playerColor ?? "#FFFFFF"}
              onChange={handleColorChange}
              onClose={() => setColorPickerOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
};

type PlayerRowProps = Player & {
  isLocalPlayer: boolean;
  isHost: boolean;
  isCaptain: boolean;
};

const PlayerRow = (props: PlayerRowProps) => {
  const { name, isLocalPlayer, isCaptain } = props;
  const nameInputRef = useRef<NameInputRef>(null);

  return (
    <PlayerRowContainer>
      <PlayerIcon {...props} player={props} nameInputRef={nameInputRef} />
      {isCaptain && <CaptainStar>⭐</CaptainStar>}
      <NameInput
        ref={nameInputRef}
        value={name ?? ""}
        onChange={(e) => {
          send({ type: "generic", event: { type: "nameChange", name: e } });
        }}
        readonly={!isLocalPlayer}
      />
    </PlayerRowContainer>
  );
};

export const Players = () => {
  const players = usePlayers();
  useListenToEntities(players, ["playerColor", "name", "team", "sheepCount"]);
  const rounds = useReactiveVar(roundsVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const captainsDraft = useReactiveVar(captainsDraftVar);
  const localPlayer = useLocalPlayer();

  const captains = captainsDraft?.captains;

  return (
    <PlayersCard>
      <PlayersGrid>
        <GridHeader>Players</GridHeader>
        <GridHeader $align="right">Sheep count</GridHeader>
        <GridHeader $align="right">Average time</GridHeader>
        {players.map((p) => {
          const playerRounds = rounds.filter((r) =>
            r.sheep.includes(p.id) && r.sheep.length === players.filter((p) =>
                p.team === "sheep"
              ).length &&
            r.wolves.length ===
              players.filter((p) => p.team === "wolf").length
          );

          return (
            <Fragment key={p.id}>
              <PlayerRow
                {...p}
                isLocalPlayer={p.id === localPlayer?.id}
                isHost={localPlayer?.id === lobbySettings.host}
                isCaptain={captains?.includes(p.id) ?? false}
              />
              <GridHeader $align="right">
                {p.sheepCount}
              </GridHeader>
              <GridHeader $align="right">
                {playerRounds.length
                  ? formatDuration(
                    playerRounds.reduce((sum, r) => sum + r.duration, 0) /
                      playerRounds.length,
                    true,
                  )
                  : "-"}
              </GridHeader>
            </Fragment>
          );
        })}
      </PlayersGrid>
    </PlayersCard>
  );
};
