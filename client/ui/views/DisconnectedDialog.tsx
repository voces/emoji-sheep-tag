import { useReactiveVar } from "@/hooks/useVar.tsx";
import { connectionStatusVar, stateVar } from "@/vars/state.ts";
import { Button } from "@/components/forms/Button.tsx";
import { VStack } from "@/components/layout/Layout.tsx";
import { Dialog } from "@/components/layout/Dialog.tsx";
import { stopReconnecting } from "../../connection.ts";
import { unloadEcs } from "../../ecs.ts";
import { generateDoodads } from "@/shared/map.ts";
import { confirmEditorExit } from "@/util/editorExitConfirmation.ts";

export const DisconnectedDialog = () => {
  const connectionStatus = useReactiveVar(connectionStatusVar);
  if (connectionStatus !== "disconnected") return null;

  const handleGiveUp = () => {
    if (!confirmEditorExit()) return;

    stateVar("menu");
    unloadEcs();
    generateDoodads(["dynamic"]);
    stopReconnecting();
    connectionStatusVar("notConnected");
  };

  return (
    <Dialog>
      <VStack>
        <div>Disconnected! Reconnecting...</div>
        <Button onClick={handleGiveUp}>Give up</Button>
      </VStack>
    </Dialog>
  );
};
