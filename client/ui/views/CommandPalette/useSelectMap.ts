import { useEffect, useMemo, useState } from "react";
import { editorCurrentMapVar, editorVar } from "@/vars/editor.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { send } from "../../../client.ts";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import {
  listLocalMaps,
  type LocalMapMetadata,
} from "../../../storage/localMaps.ts";
import { uploadAndSelectCustomMap } from "../../../actions/uploadCustomMap.ts";
import {
  confirmEditorExit,
  resetEditorModifiedState,
} from "@/util/editorExitConfirmation.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { localMapsRefreshVar } from "@/vars/localMapsRefresh.ts";

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export const useSelectMap = () => {
  const [localMaps, setLocalMaps] = useState<LocalMapMetadata[]>([]);
  const refreshTrigger = useReactiveVar(localMapsRefreshVar);

  useEffect(() => {
    listLocalMaps().then(setLocalMaps).catch((err) => {
      console.error("Failed to load custom maps:", err);
      setLocalMaps([]);
    });
  }, [refreshTrigger]);

  return useMemo(
    () => ({
      name: "Select map",
      description: "Change the current map in the editor",
      valid: () => editorVar(),
      callback: () => ({
        type: "options" as const,
        placeholder: "Map",
        commands: [
          ...MAPS.map((map) => ({
            name: map.name,
            callback: () => {
              if (!confirmEditorExit()) return;

              send({ type: "cancel" });
              const cancelStateVarSubscription = stateVar.subscribe((value) => {
                if (value !== "lobby") return;
                cancelStateVarSubscription();
                queueMicrotask(() => stateVar("playing"));
                send({ type: "lobbySettings", map: map.id });
                const cancelLobbySettingsVarSubscription = lobbySettingsVar
                  .subscribe((settings) => {
                    if (settings.map !== map.id) return;
                    cancelLobbySettingsVarSubscription();
                    send({ type: "start", practice: true, editor: true });
                    resetEditorModifiedState();
                    editorCurrentMapVar({ id: map.id, name: map.name });
                  });
              });
            },
          })),
          ...localMaps.map((map) => ({
            name: map.name,
            description: `By ${map.author} • ${formatTimestamp(map.timestamp)}`,
            callback: () => {
              if (!confirmEditorExit()) return;

              send({ type: "cancel" });
              const cancelStateVarSubscription = stateVar.subscribe((value) => {
                if (value !== "lobby") return;
                cancelStateVarSubscription();
                queueMicrotask(() => stateVar("playing"));
                uploadAndSelectCustomMap(map.id).then(() => {
                  const expectedMapId = `local:${map.id}`;
                  const cancelLobbySettingsVarSubscription = lobbySettingsVar
                    .subscribe((settings) => {
                      if (settings.map !== expectedMapId) return;
                      cancelLobbySettingsVarSubscription();
                      send({ type: "start", practice: true, editor: true });
                      resetEditorModifiedState();
                      editorCurrentMapVar({ id: map.id, name: map.name });
                    });
                }).catch((err) => {
                  console.error("Failed to upload custom map:", err);
                  alert(
                    `Failed to load map: ${
                      err instanceof Error ? err.message : "Unknown error"
                    }`,
                  );
                });
              });
            },
          })),
        ],
      }),
    }),
    [localMaps],
  );
};
