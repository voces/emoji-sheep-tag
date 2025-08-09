import { styled } from "npm:styled-components";
import { useReactiveVar } from "./hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "./vars/state.ts";
import { Lobby } from "./pages/Lobby/index.tsx";
import { Menu } from "./pages/Menu.tsx";
import { Game } from "./pages/Game/index.tsx";
import { CommandPalette } from "./components/CommandPalette.tsx";
import { Settings } from "./pages/Settings/index.tsx";
import { Wrapper } from "./Wrapper.tsx";
import { Card } from "@/components/layout/Card.tsx";

const pages = {
  menu: Menu,
  lobby: Lobby,
  playing: Game,
};

const DisconnectedCard = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Disconnected = () => {
  const connectionStatus = useReactiveVar(connectionStatusVar);
  if (connectionStatus !== "disconnected") return null;
  return (
    <DisconnectedCard>
      Disconnected! Reconnecting...
    </DisconnectedCard>
  );
};

export const App = () => {
  const state = useReactiveVar(stateVar);
  const Page = pages[state];

  return (
    <Wrapper>
      <Page />
      <Disconnected />
      <CommandPalette />
      <Settings />
    </Wrapper>
  );
};
