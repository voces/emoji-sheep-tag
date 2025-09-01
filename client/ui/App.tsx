import { useReactiveVar } from "./hooks/useVar.tsx";
import { stateVar } from "./vars/state.ts";
import { Lobby } from "./views/Lobby/index.tsx";
import { Menu } from "./views/Menu.tsx";
import { Game } from "./views/Game/index.tsx";
import { CommandPalette } from "./views/CommandPalette.tsx";
import { Settings } from "./views/Settings/index.tsx";
import { Wrapper } from "./Wrapper.tsx";
import { DisconnectedDialog } from "./views/DisconnectedDialog.tsx";

const pages = {
  menu: Menu,
  lobby: Lobby,
  playing: Game,
};

export const App = () => {
  const state = useReactiveVar(stateVar);
  const Page = pages[state];

  return (
    <Wrapper>
      <Page />
      <DisconnectedDialog />
      <CommandPalette />
      <Settings />
    </Wrapper>
  );
};
