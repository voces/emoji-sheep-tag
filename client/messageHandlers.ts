import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { stateVar } from "@/vars/state.ts";
import { app, map, unloadEcs } from "./ecs.ts";
import { camera } from "./graphics/three.ts";
import {
  clearDoodads,
  generateDoodads,
  getMap,
  getMapCenter,
  type PackedMap,
  setMapForApp,
} from "@/shared/map.ts";
import { stats } from "./util/Stats.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { captainsDraftVar } from "@/vars/captainsDraft.ts";
import type { ServerToClientMessage, Update } from "./schemas.ts";
import { editorVar } from "@/vars/editor.ts";
import { send } from "./client.ts";
import { colorName, getPlayer, getPlayers } from "@/shared/api/player.ts";
import { getWebSocket } from "./connection.ts";
import { LocalWebSocket } from "./local.ts";
import { lobbiesVar } from "@/vars/lobbies.ts";
import { applyZoom } from "./api/player.ts";
import { loadClientMap } from "./maps.ts";
import { unpackMap2D } from "@/shared/util/2dPacking.ts";
import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "@/shared/pathing/terrainHelpers.ts";
import { storeReceivedMap } from "./storage/receivedMaps.ts";
import { getLocalMap, saveLocalMap } from "./storage/localMaps.ts";
import { triggerLocalMapsRefresh } from "@/vars/localMapsRefresh.ts";

const processUpdates = (updates: ReadonlyArray<Update>) => {
  const players = updates.filter((u) => u.isPlayer || map[u.id]?.isPlayer);

  app.batch(() => {
    // Add player entities to ECS
    for (const { __delete, ...player } of players) {
      if (player.id in map) Object.assign(map[player.id], player);
      else map[player.id] = app.addEntity(player);
    }

    // Add other entities
    for (const { __delete, ...update } of updates) {
      if (update.isPlayer || map[update.id]?.isPlayer) continue;
      if (update.id in map) Object.assign(map[update.id], update);
      else map[update.id] = app.addEntity(update);

      if (__delete) {
        app.removeEntity(map[update.id]);
        delete map[update.id];
      }
    }

    for (const p of players) {
      if (p.__delete) {
        app.removeEntity(map[p.id]);
        delete map[p.id];
      }
    }
  });
};

let currentMapId = lobbySettingsVar().map;
let pendingMapId: string | null = null;
let inflightMapPromise: Promise<void> | null = null;

export const ensureMapLoaded = async (map: string) => {
  if (!map) return;
  if (map === currentMapId && !pendingMapId) return;

  pendingMapId = map;
  const promise = (async () => {
    const loadedMap = await loadClientMap(map);
    if (pendingMapId !== map) return;

    app.batch(() => {
      clearDoodads();
      setMapForApp(app, loadedMap);
      generateDoodads();
    });

    currentMapId = map;
    pendingMapId = null;
  })();

  inflightMapPromise = promise;
  try {
    await promise;
  } finally {
    if (inflightMapPromise === promise) inflightMapPromise = null;
  }
};

export const handlers = {
  join: (data: Extract<ServerToClientMessage, { type: "join" }>) => {
    if (data.localPlayer) localPlayerIdVar(data.localPlayer);

    const prevPlayers = getPlayers();
    const players = data.updates.filter((p) => p.isPlayer);
    const newPlayers = players.filter((p) =>
      !prevPlayers.some((p2) => p2.id === p.id) && data.localPlayer !== p.id
    );
    const localNewPlayer = players.find((p) => p.id === data.localPlayer);

    if (newPlayers.length) {
      if (localNewPlayer) {
        addChatMessage(
          `Joined the game ${data.lobby} with player${
            newPlayers.length > 1 ? "s" : ""
          } ${
            new Intl.ListFormat().format(
              newPlayers.map(colorName),
            )
          }.`,
        );
      } else {
        addChatMessage(`${
          new Intl.ListFormat().format(
            newPlayers.map(colorName),
          )
        } ${newPlayers.length > 1 ? "have" : "has"} joined the game!`);
      }
    } else if (localNewPlayer && !editorVar()) {
      addChatMessage(`Joined the game ${data.lobby}.`);
    }

    stateVar(data.status);
    ensureMapLoaded(data.lobbySettings.map);
    lobbySettingsVar(data.lobbySettings);
    captainsDraftVar(data.captainsDraft ?? undefined);
    processUpdates(data.updates);

    if (data.rounds) roundsVar(data.rounds);

    if (editorVar()) {
      stateVar("playing");
      send({ type: "start", practice: true, editor: true });
    }
  },
  start: (e: Extract<ServerToClientMessage, { type: "start" }>) => {
    stateVar("lobby");
    unloadEcs();
    stateVar("playing");
    if (e.updates) processUpdates(e.updates);
    const center = getMapCenter();
    camera.position.x = center.x;
    camera.position.y = center.y;
    applyZoom(true);
  },
  stop: (d: Extract<ServerToClientMessage, { type: "stop" }>) => {
    stateVar("lobby");
    unloadEcs();
    generateDoodads(["dynamic"]);
    if (d.updates) processUpdates(d.updates);
    if (d.round) roundsVar((r) => [...r, d.round!]);
  },
  updates: (data: Extract<ServerToClientMessage, { type: "updates" }>) => {
    processUpdates(
      stateVar() === "playing"
        ? data.updates
        : data.updates.filter((u) => u.isPlayer || map[u.id]?.isPlayer),
    );
  },
  leave: (data: Extract<ServerToClientMessage, { type: "leave" }>) => {
    processUpdates(data.updates);
    lobbySettingsVar(data.lobbySettings);
  },
  pong: ({ data }: Extract<ServerToClientMessage, { type: "pong" }>) => {
    if (typeof data === "number") {
      stats.msPanel.update(performance.now() - data, 100);
    }
  },
  chat: (
    { player, message }: Extract<ServerToClientMessage, { type: "chat" }>,
  ) => {
    const p = getPlayer(player);
    addChatMessage(p ? `${colorName(p)}: ${message}` : message);
  },
  lobbySettings: (
    { type: _type, ...lobbySettings }: Extract<
      ServerToClientMessage,
      { type: "lobbySettings" }
    >,
  ) => {
    ensureMapLoaded(lobbySettings.map);
    lobbySettingsVar(lobbySettings);
  },
  captainsDraft: (
    data: Extract<ServerToClientMessage, { type: "captainsDraft" }>,
  ) => {
    console.log("[captainsDraft]", data.phase ?? "(clearing)");
    if (!data.phase) {
      captainsDraftVar(undefined);
    } else {
      captainsDraftVar({
        phase: data.phase,
        captains: data.captains!,
        picks: data.picks!,
        currentPicker: data.currentPicker!,
        picksThisTurn: data.picksThisTurn!,
      });
    }
  },
  mapUpdate: (data: Extract<ServerToClientMessage, { type: "mapUpdate" }>) => {
    const currentMap = getMap();
    const tiles = unpackMap2D(data.terrain);
    const cliffs = unpackMap2D(data.cliffs).map((row) =>
      row.map((value) => (value === 0 ? "r" : value - 1))
    ) as (number | "r")[][];

    const rawPathing = getPathingMaskFromTerrainMasks(
      tiles,
      cliffs,
      data.bounds,
    );
    const terrainPathingMap = rawPathing.toReversed();
    const terrainLayers = rawPathing.map((row, y) =>
      row.map((_, x) => Math.floor(getCliffHeight(x, y, cliffs)))
    ).toReversed();

    const updatedMap = {
      ...currentMap,
      id: `${currentMap.id}-resized-${Date.now()}`,
      tiles,
      cliffs,
      width: data.width,
      height: data.height,
      bounds: data.bounds,
      center: data.center,
      terrainPathingMap,
      terrainLayers,
    };

    setMapForApp(app, updatedMap);
    // The terrain will be automatically updated by the onMapChange listener in three.ts
  },
  hubState: (
    { lobbies }: Extract<ServerToClientMessage, { type: "hubState" }>,
  ) => {
    // In offline mode, auto-join the first lobby if one exists
    const ws = getWebSocket();
    if (ws instanceof LocalWebSocket && lobbies.length > 0) {
      send({ type: "joinLobby", lobbyName: lobbies[0].name });
      return;
    }

    // Otherwise, switch to hub view
    stateVar("hub");
    lobbiesVar(lobbies);
  },
  uploadCustomMap: async (
    { mapId, mapData }: Extract<
      ServerToClientMessage,
      { type: "uploadCustomMap" }
    >,
  ) => {
    // Store the received custom map data so it can be loaded when needed
    storeReceivedMap(mapId, mapData as PackedMap);

    // Also save to IndexedDB if we don't already have it
    const localId = mapId.replace("local:", "");
    const existing = await getLocalMap(localId);

    if (!existing) {
      const packedMap = mapData as PackedMap;

      // Use the name from PackedMap if available, otherwise generate from ID
      const friendlyName = packedMap.name || (() => {
        const namePart = localId.replace(/-\d+$/, ""); // Remove timestamp
        return namePart
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      })();

      try {
        await saveLocalMap(localId, friendlyName, packedMap);
        triggerLocalMapsRefresh();
        addChatMessage(`Received map "${friendlyName}" from host`);
      } catch (err) {
        console.error("Failed to save received map:", err);
      }
    }
  },
};
