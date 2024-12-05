import { styled } from "npm:styled-components";
import { Card } from "../components/Card.ts";
import { useReactiveVar } from "../hooks/useVar.tsx";
import { Player, playersVar } from "../vars/players.ts";
import { ColorPicker } from "../components/ColorPicker.ts";
import { Box } from "../components/Box.ts";
import { Button } from "../components/Button.ts";
import { send } from "../../client.ts";
import { ChangeEvent } from "npm:@types/react";

const PlayerRow = ({ name, color }: Player) => (
  <Box $gap={4}>
    <ColorPicker
      value={color}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        console.log(e.currentTarget.value);
      }}
    />
    <span>{name}</span>
  </Box>
);

const Players = () => {
  const players = useReactiveVar(playersVar);

  return (
    <Card color="blue" style={{ width: "30%", height: "60%" }}>
      <div>Players</div>
      <div>
        {players.map((p) => <PlayerRow key={p.name} {...p} />)}
      </div>
    </Card>
  );
};

const Settings = () => (
  <Card color="purple" style={{ width: "40%", height: "60%" }}>
    <Button
      onClick={() => send({ type: "start" })}
    >
      Start
    </Button>
  </Card>
);

const LobbyContainer = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
});

export const Lobby = () => (
  <LobbyContainer>
    <Players />
    <Settings />
  </LobbyContainer>
);
