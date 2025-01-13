import { useReactiveVar } from "./hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "./vars/state.ts";
import { ThemeProvider } from "npm:styled-components";
import { theme } from "./theme.ts";
import { Lobby } from "./pages/Lobby.tsx";
import { Menu } from "./pages/Menu.tsx";
import { Game } from "./pages/Game.tsx";

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
  if (connectionStatus !== "disconnected") return null;
  return (
    <div className="abs-center card">
      Disconnected! Reconnecting...
    </div>
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
