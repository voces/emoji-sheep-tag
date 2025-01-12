import { styled } from "npm:styled-components";
import { Card } from "../components/Card.ts";
import { useReactiveVar } from "../hooks/useVar.tsx";
import { getLocalPlayer, Player, playersVar } from "../vars/players.ts";
import { ColorPicker } from "../components/ColorPicker.tsx";
import { Box } from "../components/Box.ts";
import { Button } from "../components/Button.ts";
import { send } from "../../client.ts";

const PlayerRow = ({ name, color }: Player) => (
  <Box $gap={4}>
    <ColorPicker
      value={color}
      onChange={(e) => {
        send({ type: "generic", event: { type: "colorChange", color: e } });
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

const Settings = () => {
  useReactiveVar(playersVar); // update when host changes
  return (
    <Card color="purple" style={{ width: "40%", height: "60%" }}>
      <Button
        onClick={() => send({ type: "start" })}
        disabled={!getLocalPlayer()?.host}
      >
        Start
      </Button>
    </Card>
  );
};

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
