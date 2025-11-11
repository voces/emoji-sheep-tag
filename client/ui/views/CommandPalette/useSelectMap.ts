import { useMemo } from "react";
import { editorVar } from "@/vars/editor.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { send } from "../../../client.ts";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

export const useSelectMap = () =>
  useMemo(
    () => ({
      name: "Select map",
      description: "Change the current map in the editor",
      valid: () => editorVar(),
      callback: () => ({
        type: "options" as const,
        placeholder: "Map",
        commands: MAPS.map((map) => ({
          name: map.name,
          description: map.description || `Load the ${map.name} map`,
          callback: () => {
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
                });
            });
          },
        })),
      }),
    }),
    [],
  );
