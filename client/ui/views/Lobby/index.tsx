import { styled } from "styled-components";
import { Positional, VStack } from "@/components/layout/Layout.tsx";
import { Players } from "./Players.tsx";
import { Chat } from "./Chat.tsx";
import { LobbySettings } from "./LobbySettings.tsx";
import { CaptainsDraft } from "./CaptainsDraft.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";

const LobbyContent = styled(VStack)<{ $expanded?: boolean }>`
  width: ${({ $expanded }) => ($expanded ? "100%" : "60%")};
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

export const Lobby = () => {
  const captainsDraft = useReactiveVar(captainsDraftVar);
  const inCaptainsMode = !!captainsDraft &&
    captainsDraft.phase !== "drafted" &&
    captainsDraft.phase !== "reversed";

  return (
    <LobbyMain>
      <LobbyContent $expanded={inCaptainsMode}>
        {inCaptainsMode ? <CaptainsDraft /> : <Players />}
        <Chat />
      </LobbyContent>
      {!inCaptainsMode && <LobbySettings />}
    </LobbyMain>
  );
};
