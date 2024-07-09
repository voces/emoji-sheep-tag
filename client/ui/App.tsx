import { styled } from "npm:styled-components";
import { Card } from "./components/Card.ts";
import { useReactiveVar } from "./hooks/useVar.tsx";
import { Player, playersVar } from "./vars/players.ts";
import { stateVar } from "./vars/state.ts";
import { ThemeProvider } from "npm:styled-components";
import { theme } from "./theme.ts";
import { ColorPicker } from "./components/ColorPicker.ts";
import { Box } from "./components/Box.ts";
import { Button } from "./components/Button.ts";

const PlayerRow = ({ name, color }: Player) => (
  <Box $gap={4}>
    <ColorPicker
      value={color}
      onChange={(e) => {
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

const Settings = () => {
  return (
    <Card color="purple" style={{ width: "40%", height: "60%" }}>
      <Button onClick={() => alert("start!")}>Start</Button>
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
const Lobby = () => {
  return (
    <LobbyContainer>
      <Players />
      <Settings />
    </LobbyContainer>
  );
};

const Game = () => {
  return <div>Game</div>;
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

export const App = () => {
  const state = useReactiveVar(stateVar);

  const Page = state === "lobby" ? Lobby : Game;

  return (
    <Wrapper>
      <Page />
    </Wrapper>
  );
};
