import { styled } from "npm:styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "@/vars/state.ts";
import { Card } from "@/components/layout/Card.tsx";
import { Button } from "@/components/forms/Button.tsx";
import { Overlay, VStack } from "@/components/layout/Layout.tsx";
import { stopReconnecting } from "../../connection.ts";
import { unloadEcs } from "../../ecs.ts";
import { playersVar } from "@/vars/players.ts";

const DisconnectedCard = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const DisconnectedDialog = () => {
  const connectionStatus = useReactiveVar(connectionStatusVar);
  if (connectionStatus !== "disconnected") return null;

  const handleGiveUp = () => {
    stateVar("menu");
    unloadEcs();
    playersVar([]);
    stopReconnecting();
    connectionStatusVar("notConnected");
  };

  return (
    <Overlay>
      <DisconnectedCard>
        <VStack>
          <div>Disconnected! Reconnecting...</div>
          <Button onClick={handleGiveUp}>Give up</Button>
        </VStack>
      </DisconnectedCard>
    </Overlay>
  );
};
