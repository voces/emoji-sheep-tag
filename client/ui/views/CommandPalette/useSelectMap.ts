import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { editorCurrentMapVar, editorVar } from "@/vars/editor.ts";
import { getMapManifestTags, MAPS } from "@/shared/maps/manifest.ts";
import { type LobbyMode, mapMatchesMode } from "@/shared/maps/tags.ts";
import { send } from "../../../messaging.ts";
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

/**
 * Pick a lobby mode compatible with the map's tags. If the current mode is
 * already compatible, keep it. Otherwise prefer "bulldog" when bulldog is the
 * only fit, else fall back to "survival".
 */
const modeForMap = (
  tags: readonly string[],
  currentMode: LobbyMode,
): LobbyMode | undefined => {
  if (mapMatchesMode(tags, currentMode)) return undefined;
  if (tags.includes("survival")) return "survival";
  if (tags.includes("bulldog")) return "bulldog";
  return undefined;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

export const useSelectMap = () => {
  const { t } = useTranslation();
  const [localMaps, setLocalMaps] = useState<LocalMapMetadata[]>([]);
  const refreshTrigger = useReactiveVar(localMapsRefreshVar);

  useEffect(() => {
    listLocalMaps().then(setLocalMaps).catch((err) => {
      if (err instanceof Error && err.message === "IndexedDB not available") {
        setLocalMaps([]);
        return;
      }
      console.error("Failed to load custom maps:", err);
      setLocalMaps([]);
    });
  }, [refreshTrigger]);

  const tagLabel = (tag: string) => t(`mapTag.${tag}`, { defaultValue: tag });
  const formatTags = (tags: readonly string[]) =>
    tags.length ? tags.map(tagLabel).join(" · ") : "";

  return useMemo(
    () => ({
      name: t("commands.selectMap"),
      description: t("commands.selectMapDesc"),
      valid: () => editorVar(),
      callback: () => ({
        type: "options" as const,
        placeholder: t("commands.selectMapPlaceholder"),
        commands: [
          ...MAPS.map((map) => ({
            name: map.name,
            description: formatTags(getMapManifestTags(map)),
            searchTerms: getMapManifestTags(map).map(tagLabel).join(" "),
            callback: () => {
              if (!confirmEditorExit()) return;

              send({ type: "cancel" });
              const cancelStateVarSubscription = stateVar.subscribe((value) => {
                if (value !== "lobby") return;
                cancelStateVarSubscription();
                queueMicrotask(() => stateVar("playing"));
                const newMode = modeForMap(
                  getMapManifestTags(map),
                  lobbySettingsVar().mode,
                );
                send({
                  type: "lobbySettings",
                  map: map.id,
                  ...(newMode ? { mode: newMode } : {}),
                });
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
            description: [
              t("commands.selectMapAuthorTimestamp", {
                author: map.author,
                timestamp: formatTimestamp(map.timestamp),
              }),
              formatTags(map.tags),
            ].filter(Boolean).join(" · "),
            searchTerms: map.tags.map(tagLabel).join(" "),
            callback: () => {
              if (!confirmEditorExit()) return;

              send({ type: "cancel" });
              const cancelStateVarSubscription = stateVar.subscribe((value) => {
                if (value !== "lobby") return;
                cancelStateVarSubscription();
                queueMicrotask(() => stateVar("playing"));
                const newMode = modeForMap(map.tags, lobbySettingsVar().mode);
                if (newMode) send({ type: "lobbySettings", mode: newMode });
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
    [localMaps, t],
  );
};
