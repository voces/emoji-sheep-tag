import { useReactiveVar } from "./hooks/useVar.tsx";
import { stateVar } from "./vars/state.ts";
import { ThemeProvider } from "npm:styled-components";
import { theme } from "./theme.ts";
import { Fragment } from "npm:react";
import { Lobby } from "./pages/Lobby.tsx";
import { Card } from "./components/Card.ts";
import { Button } from "./components/Button.ts";
import { loadLocal } from "../local.ts";

const Intro = () => (
  <Card
    style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    }}
  >
    Connecting...
  </Card>
);

const Menu = () => (
  <Card
    style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      textAlign: "center",
    }}
  >
    <h1>Server offline</h1>
    <Button onClick={loadLocal}>Single player</Button>
  </Card>
);

const Game = () => <div>Game</div>;

const pages = {
  intro: Intro,
  menu: Menu,
  lobby: Lobby,
  playing: Game,
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

export const App = () => {
  const state = useReactiveVar(stateVar);
  const Page = pages[state];

  return (
    <Wrapper>
      <Page />
    </Wrapper>
  );
};
