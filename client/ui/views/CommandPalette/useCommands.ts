import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { send } from "../../../messaging.ts";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { addChatMessage } from "@/vars/chat.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { connectionStatusVar, stateVar } from "@/vars/state.ts";
import { flags } from "../../../flags.ts";
import { getLocalPlayer, isLocalPlayerHost } from "../../../api/player.ts";
import { getPlayers } from "@/shared/api/player.ts";
import { isPlayerIgnored, toggleIgnoredPlayer } from "@/vars/ignoredPlayers.ts";
import {
  editorCurrentMapVar,
  editorHideUIVar,
  editorMapModifiedVar,
  editorVar,
} from "@/vars/editor.ts";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { practiceVar } from "@/vars/practice.ts";
import { MAPS } from "@/shared/maps/manifest.ts";
import { disconnect, isMultiplayer } from "../../../connection.ts";
import { unloadEcs } from "../../../ecs.ts";
import { generateDoodads } from "@/shared/map.ts";
import { useCopyMap } from "./useCopyMap.ts";
import { useSelectMap } from "./useSelectMap.ts";
import { useSaveMapAs } from "./useSaveMapAs.ts";
import { useQuickSaveMap } from "./useQuickSaveMap.ts";
import { useNewMap } from "./useNewMap.ts";

export type CommandResult =
  | void
  | { type: "prompt"; placeholder: string; callback: (value: string) => void }
  | { type: "options"; placeholder: string; commands: Command[] };

export type Command = {
  name: string;
  description?: string;
  group?: string;
  searchTerms?: string;
  valid?: () => boolean;
  callback: () => CommandResult | Promise<CommandResult>;
};

export const useCommands = (): Command[] => {
  const { t, i18n } = useTranslation();
  const uiSettings = useReactiveVar(uiSettingsVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  const currentMap = useReactiveVar(editorCurrentMapVar);
  const mapModified = useReactiveVar(editorMapModifiedVar);
  const isEditor = useReactiveVar(editorVar);
  const hideUI = useReactiveVar(editorHideUIVar);
  const practice = useReactiveVar(practiceVar);
  const copyMap = useCopyMap();
  const selectMap = useSelectMap();
  const saveMapAs = useSaveMapAs();
  const quickSaveMap = useQuickSaveMap();
  const newMap = useNewMap();

  return useMemo((): Command[] => [
    ...(isEditor
      ? [
        ...((currentMap && !MAPS.find((m) => m.id === currentMap.id))
          ? [quickSaveMap, saveMapAs, copyMap, selectMap, newMap]
          : mapModified
          ? [saveMapAs, copyMap, selectMap, newMap]
          : [selectMap, copyMap, newMap]).map((c) => ({
            ...c,
            group: t("commands.groupEditor"),
          })),
        {
          name: t(
            lobbySettings.view ? "commands.enableFog" : "commands.disableFog",
          ),
          description: t("commands.fogDesc"),
          group: t("commands.groupEditor"),
          callback: () =>
            send({ type: "lobbySettings", view: !lobbySettings.view }),
        },
        {
          name: t(hideUI ? "commands.showUI" : "commands.hideUI"),
          description: t("commands.uiDesc"),
          group: t("commands.groupEditor"),
          callback: () => editorHideUIVar(!hideUI),
        },
      ]
      : []),
    {
      name: t("commands.cancelRound"),
      description: t("commands.cancelRoundDesc"),
      group: t("commands.groupRound"),
      valid: () => stateVar() === "playing" && isLocalPlayerHost() && !isEditor,
      callback: () => send({ type: "cancel" }),
    },
    {
      name: t("commands.resetGold"),
      description: t("commands.resetGoldDesc"),
      group: t("commands.groupRound"),
      valid: () => practice && isLocalPlayerHost(),
      callback: () => send({ type: "resetGold" }),
    },
    {
      name: t(
        lobbySettings.view ? "commands.enableFog" : "commands.disableFog",
      ),
      description: t("commands.fogDesc"),
      group: t("commands.groupRound"),
      valid: () => practice && isLocalPlayerHost() && !isEditor,
      callback: () =>
        send({ type: "lobbySettings", view: !lobbySettings.view }),
    },
    {
      name: t("commands.ignorePlayer"),
      description: t("commands.ignorePlayerDesc"),
      group: t("commands.groupPlayers"),
      valid: () =>
        !isEditor &&
        getPlayers().some((p) =>
          p.id !== getLocalPlayer()?.id && !p.isComputer && !!p.clientId
        ),
      callback: () => ({
        type: "options",
        placeholder: t("commands.ignorePlayerPlaceholder"),
        commands: getPlayers()
          .filter((p) =>
            p.id !== getLocalPlayer()?.id && !p.isComputer && !!p.clientId
          )
          .map((p) => ({
            name: `${
              isPlayerIgnored(p.clientId)
                ? t("commands.unignore")
                : t("commands.ignore")
            } ${p.name}`,
            callback: () => toggleIgnoredPlayer(p.clientId!),
          })),
      }),
    },
    {
      name: t("commands.banPlayer"),
      description: t("commands.banPlayerDesc"),
      group: t("commands.groupPlayers"),
      valid: () =>
        !isEditor && isLocalPlayerHost() && stateVar() === "playing" &&
        getPlayers().some((p) =>
          p.id !== getLocalPlayer()?.id && !p.isComputer
        ),
      callback: () => ({
        type: "options",
        placeholder: t("commands.banPlayerPlaceholder"),
        commands: getPlayers()
          .filter((p) => p.id !== getLocalPlayer()?.id && !p.isComputer)
          .map((p) => ({
            name: `${t("commands.ban")} ${p.name}`,
            callback: () =>
              send({
                type: "generic",
                event: { type: "ban", playerId: p.id },
              }),
          })),
      }),
    },
    {
      name: t("commands.leaveLobby"),
      description: t("commands.leaveLobbyDesc"),
      group: t("commands.groupNavigate"),
      valid: () =>
        (stateVar() === "lobby" || stateVar() === "playing") && !isEditor &&
        isMultiplayer(),
      callback: () => send({ type: "leaveLobby" }),
    },
    {
      name: t("commands.exitToMenu"),
      description: t("commands.exitToMenuDesc"),
      group: t("commands.groupNavigate"),
      valid: () => stateVar() !== "menu" && !isEditor,
      callback: () => {
        disconnect();
        stateVar("menu");
        unloadEcs({ includePlayers: true });
        generateDoodads(["dynamic"]);
        connectionStatusVar("notConnected");
      },
    },
    {
      name: t("commands.openSettings"),
      description: t("commands.openSettingsDesc"),
      group: t("commands.groupNavigate"),
      callback: () => showSettingsVar(true),
    },
    {
      name: t(
        uiSettings.showPing ? "commands.hidePing" : "commands.showPing",
      ),
      description: t("commands.pingDesc"),
      group: t("commands.groupDisplay"),
      callback: () =>
        uiSettingsVar({ ...uiSettings, showPing: !uiSettings.showPing }),
    },
    {
      name: t(uiSettings.showFps ? "commands.hideFps" : "commands.showFps"),
      description: t("commands.fpsDesc"),
      group: t("commands.groupDisplay"),
      callback: () =>
        uiSettingsVar({ ...uiSettings, showFps: !uiSettings.showFps }),
    },
    {
      name: t("commands.setLatency"),
      description: t("commands.setLatencyDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Latency (MS)",
        callback: (latency: string) => {
          const value = parseFloat(latency) || 0;
          globalThis.latency = value;
          addChatMessage(`Latency set to ${value}ms.`);
        },
      }),
    },
    {
      name: t("commands.setNoise"),
      description: t("commands.setNoiseDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => ({
        type: "prompt",
        placeholder: "Noise (MS)",
        callback: (noise: string) => {
          const value = parseFloat(noise) || 0;
          globalThis.noise = value;
          addChatMessage(`Noise set to ${value}ms.`);
        },
      }),
    },
    {
      name: t(
        flags.debugPathing
          ? "commands.disablePathDebug"
          : "commands.enablePathDebug",
      ),
      description: t("commands.pathDebugDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () => {
        flags.debugPathing = !flags.debugPathing;
        if (flags.debugPathing) localStorage.setItem("debug-pathing", "true");
        else localStorage.removeItem("debug-pathing");
      },
    },
    {
      name: t(
        i18n.language === "pseudo"
          ? "commands.disablePseudo"
          : "commands.enablePseudo",
      ),
      description: t("commands.pseudoDesc"),
      group: t("commands.groupDebug"),
      valid: () => flags.debug,
      callback: () =>
        i18n.changeLanguage(i18n.language === "pseudo" ? "en" : "pseudo"),
    },
  ], [
    t,
    copyMap,
    selectMap,
    saveMapAs,
    quickSaveMap,
    newMap,
    currentMap,
    mapModified,
    isEditor,
    hideUI,
    lobbySettings.view,
    flags.debug,
    flags.debugPathing,
    i18n.language,
    uiSettings.showPing,
    uiSettings.showFps,
    practice,
  ]);
};
