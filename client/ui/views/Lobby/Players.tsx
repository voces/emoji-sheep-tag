import { Fragment } from "react";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { Player } from "@/shared/api/player.ts";
import { useLocalPlayer, usePlayers } from "@/hooks/usePlayers.ts";
import { ColorPicker } from "@/components/forms/ColorPicker.tsx";
import { NameInput } from "@/components/forms/NameInput.tsx";
import { send } from "../../../client.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { formatDuration } from "@/util/formatDuration.ts";
import { HStack } from "@/components/layout/Layout.tsx";
import { Card } from "@/components/layout/Card.tsx";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { useListenToEntities } from "@/hooks/useListenToEntityProp.ts";

const PlayerRowContainer = styled(HStack)`
  align-items: center;
`;

const PlayersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

const PlayerRow = ({ name, playerColor, id }: Player) => {
  const localPlayer = useLocalPlayer();
  return (
    <PlayerRowContainer>
      <ColorPicker
        value={playerColor ?? "#FFFFFF"}
        onChange={(e) => {
          send({ type: "generic", event: { type: "colorChange", color: e } });
        }}
        readonly={id !== localPlayer?.id}
      />
      <NameInput
        value={name ?? ""}
        onChange={(e) => {
          send({ type: "generic", event: { type: "nameChange", name: e } });
        }}
        readonly={id !== localPlayer?.id}
      />
    </PlayerRowContainer>
  );
};

export const Players = () => {
  const players = usePlayers();
  useListenToEntities(players, ["playerColor", "name"]);
  const rounds = useReactiveVar(roundsVar);
  const { sheep } = useReactiveVar(lobbySettingsVar);

  return (
    <PlayersCard>
      <PlayersGrid>
        <GridHeader>Players</GridHeader>
        <GridHeader $align="right">Sheep count</GridHeader>
        <GridHeader $align="right">Average time</GridHeader>
        {players.map((p) => {
          const playerRounds = rounds.filter((r) =>
            r.sheep.includes(p.id) && r.sheep.length === sheep &&
            r.wolves.length === players.length - sheep
          );

          return (
            <Fragment key={p.name}>
              <PlayerRow {...p} />
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
