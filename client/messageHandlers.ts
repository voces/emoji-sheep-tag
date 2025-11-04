import { localPlayerIdVar } from "@/vars/localPlayerId.ts";
import { stateVar } from "@/vars/state.ts";
import { app, map, unloadEcs } from "./ecs.ts";
import { camera } from "./graphics/three.ts";
import { center, generateDoodads } from "@/shared/map.ts";
import { stats } from "./util/Stats.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import type { ServerToClientMessage, Update } from "./schemas.ts";
import { editorVar } from "@/vars/editor.ts";
import { send } from "./client.ts";
import { getPlayer, getPlayers } from "@/shared/api/player.ts";
import { getWebSocket } from "./connection.ts";
import { LocalWebSocket } from "./local.ts";
import { lobbiesVar } from "@/vars/lobbies.ts";
import { applyZoom } from "./api/player.ts";

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

export const handlers = {
  join: (data: Extract<ServerToClientMessage, { type: "join" }>) => {
    if (data.localPlayer) localPlayerIdVar(data.localPlayer);

    const prevPlayers = getPlayers();
    const players = data.updates.filter((p) => p.isPlayer);
    const newPlayers = players.filter((p) =>
      !prevPlayers.some((p2) => p2.id === p.id) && data.localPlayer !== p.id
    );

    if (newPlayers.length) {
      addChatMessage(`${
        new Intl.ListFormat().format(
          newPlayers.map((p) => `|c${p.playerColor}|${p.name}|`),
        )
      } ${newPlayers.length > 1 ? "have" : "has"} joined the game!`);
    }

    stateVar(data.status);
    lobbySettingsVar(data.lobbySettings);
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
    camera.position.x = center.x;
    camera.position.y = center.y;
    applyZoom();
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
    addChatMessage(p ? `|c${p.playerColor}|${p.name}|: ${message}` : message);
  },
  lobbySettings: (
    { type: _type, ...lobbySettings }: Extract<
      ServerToClientMessage,
      { type: "lobbySettings" }
    >,
  ) => lobbySettingsVar(lobbySettings),
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
};
