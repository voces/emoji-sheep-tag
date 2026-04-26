import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  editorCurrentMapVar,
  editorMapModifiedVar,
  editorVar,
} from "@/vars/editor.ts";
import { send } from "../../../messaging.ts";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { storeReceivedMap } from "../../../storage/receivedMaps.ts";
import { confirmEditorExit } from "@/util/editorExitConfirmation.ts";
import { buildBlankPackedMap } from "../../../util/buildBlankMap.ts";

export const useNewMap = () => {
  const { t } = useTranslation();
  return useMemo(() => ({
    name: t("commands.newMap"),
    description: t("commands.newMapDesc"),
    valid: () => editorVar(),
    callback: () => {
      if (!confirmEditorExit()) return;

      const timestamp = Date.now();
      const name = `Untitled ${new Date(timestamp).toLocaleString()}`;
      const id = `untitled-${timestamp}`;
      const mapId = `local:${id}`;
      const packed = buildBlankPackedMap(name);

      storeReceivedMap(mapId, packed);

      send({ type: "cancel" });
      const cancelStateVarSubscription = stateVar.subscribe((value) => {
        if (value !== "lobby") return;
        cancelStateVarSubscription();
        queueMicrotask(() => stateVar("playing"));
        send({ type: "uploadCustomMap", mapId, mapData: packed });
        send({ type: "lobbySettings", map: mapId });
        const cancelLobbySettingsVarSubscription = lobbySettingsVar
          .subscribe((settings) => {
            if (settings.map !== mapId) return;
            cancelLobbySettingsVarSubscription();
            send({ type: "start", practice: true, editor: true });
            editorMapModifiedVar(true);
            editorCurrentMapVar({ id, name });
          });
      });
    },
  }), [t]);
};
