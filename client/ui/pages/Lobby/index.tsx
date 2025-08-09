import { styled } from "npm:styled-components";
import { VStack, Positional } from "@/components/layout/Layout.tsx";
import { Players } from "./Players.tsx";
import { Chat } from "./Chat.tsx";
import { LobbySettings } from "./LobbySettings.tsx";

const LobbyContent = styled(VStack)`
  width: 60%;
  gap: ${({ theme }) => theme.spacing.xl};
  pointer-events: none;
`;

const LobbyMain = styled(Positional)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
  width: min(95%, 900px);
  height: min(95%, 800px);
  pointer-events: none;
`;

export const Lobby = () => (
  <LobbyMain>
    <LobbyContent>
      <Players />
      <Chat />
    </LobbyContent>
    <LobbySettings />
  </LobbyMain>
);