import { useReactiveVar } from "./hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "./vars/state.ts";
import { ThemeProvider } from "npm:styled-components";
import { theme } from "./theme.ts";
import { Lobby } from "./pages/Lobby.tsx";
import { Menu } from "./pages/Menu.tsx";
import { Card } from "./components/Card.ts";
import { position } from "../../../.cache/deno/npm/registry.npmjs.org/@types/stylis/4.2.5/index.d.ts";

const Game = () => <div>Game</div>;

const pages = {
  menu: Menu,
  lobby: Lobby,
  playing: Game,
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const Disconnected = () => {
  const connectionStatus = useReactiveVar(connectionStatusVar);
  console.log("Disconnected", connectionStatus);
  if (connectionStatus !== "disconnected") return null;
  return (
    <Card
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      Disconnected! Reconnecting...
    </Card>
  );
};

export const App = () => {
  const state = useReactiveVar(stateVar);
  const Page = pages[state];

  return (
    <Wrapper>
      <Page />
      <Disconnected />
    </Wrapper>
  );
};
