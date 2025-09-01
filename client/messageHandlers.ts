import { playersVar } from "@/vars/players.ts";
import { stateVar } from "@/vars/state.ts";
import { app, map, unloadEcs } from "./ecs.ts";
import { camera } from "./graphics/three.ts";
import { center, tiles } from "@/shared/map.ts";
import { stats } from "./util/Stats.ts";
import { data } from "./data.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { roundsVar } from "@/vars/rounds.ts";
import { formatVar } from "@/vars/format.ts";
import { format } from "./api/player.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import type { ServerToClientMessage } from "./schemas.ts";
import { checkNearPathing } from "./systems/pathing.ts";

export const handlers = {
  join: (data: Extract<ServerToClientMessage, { type: "join" }>) => {
    const prevPlayers = playersVar();
    const newPlayers = data.players.filter((p) =>
      !prevPlayers.some((p2) => p2.id === p.id) && !p.local
    );
    playersVar((prev) =>
      data.players.length !== 1 || data.players.some((p) => p.local)
        // Fully set players if we receive multiple or it includes local
        ? data.players
        : prev.some((p) => p.id === data.players[0].id)
        // Use previous players if we receive 1 player and they are already known
        ? prev
        // Otherwise append the one new player
        : [...prev, data.players[0]]
    );
    formatVar(data.format);
    if (newPlayers.length) {
      addChatMessage(`${
        new Intl.ListFormat().format(
          newPlayers.map((p) => `|c${p.color}|${p.name}|`),
        )
      } ${newPlayers.length > 1 ? "have" : "has"} joined the game!`);
    }
    stateVar(data.status);
    if (data.status === "lobby") {
      for (const entity of app.entities) app.removeEntity(entity);
      for (const key in map) delete map[key];
    }
    for (const update of data.updates) {
      if (update.id in map) Object.assign(map[update.id], update);
      else map[update.id] = app.addEntity(update);
    }
    if (data.rounds) roundsVar(data.rounds);
    if (data.lobbySettings) lobbySettingsVar(data.lobbySettings);
  },
  colorChange: (
    data: Extract<ServerToClientMessage, { type: "colorChange" }>,
  ) => {
    playersVar((players) =>
      players.map((p) => p.id === data.id ? { ...p, color: data.color } : p)
    );
  },
  nameChange: (
    data: Extract<ServerToClientMessage, { type: "nameChange" }>,
  ) => {
    playersVar((players) =>
      players.map((p) => p.id === data.id ? { ...p, name: data.name } : p)
    );
  },
  start: (e: Extract<ServerToClientMessage, { type: "start" }>) => {
    const players = playersVar((players) =>
      players.map((p) => {
        const s = e.sheep.find((s) => s.id === p.id);
        return s ? { ...p, sheepCount: s.sheepCount } : p;
      })
    );
    data.sheep = players.filter((p) => e.sheep.some((s) => s.id === p.id));
    data.wolves = players.filter((p) => e.wolves.includes(p.id));
    stateVar("playing");
    camera.position.x = center.x;
    camera.position.y = center.y;
    for (let i = 0; i < tiles[0].length * tiles.length / 3; i++) {
      const x = Math.random() * tiles[0].length;
      const y = Math.random() * tiles.length;
      const r = Math.round(37 + (Math.random() - 0.5) * 30);
      const g = Math.round(102 + (Math.random() - 0.5) * 45);
      if (checkNearPathing(x, y, 0.25, 255)) continue;
      app.addEntity({
        id: `grass-${crypto.randomUUID()}`,
        prefab: "grass",
        position: { x, y },
        playerColor: `#${r.toString(16)}${g.toString(16)}00`,
        facing: Math.round(Math.random()) * Math.PI,
      });
    }
    for (let i = 0; i < tiles[0].length * tiles.length / 20; i++) {
      const x = Math.random() * tiles[0].length;
      const y = Math.random() * tiles.length;
      if (checkNearPathing(x, y, 0.25, 255)) continue;
      const r = Math.random();
      const g = Math.random();
      const b = Math.random();
      const scale = Math.min(1 / r, 1 / g, 1 / b) * 255;
      app.addEntity({
        id: `flowers-${crypto.randomUUID()}`,
        prefab: "flowers",
        position: { x, y },
        playerColor: `#${Math.floor(r * scale).toString(16).padStart(2, "0")}${
          Math.floor(g * scale).toString(16).padStart(2, "0")
        }${Math.floor(b * scale).toString(16).padStart(2, "0")}`,
        facing: Math.round(Math.random()) * Math.PI,
      });
    }
  },
  stop: (d: Extract<ServerToClientMessage, { type: "stop" }>) => {
    stateVar("lobby");
    unloadEcs();
    if (d.players) {
      playersVar((players) =>
        players.map((p) => {
          const u = d.players?.find((p2) => p2.id === p.id);
          return u ? { ...p, sheepCount: u.sheepCount } : p;
        })
      );
    }
    if (d.round) roundsVar((r) => [...r, d.round!]);
  },
  updates: (data: Extract<ServerToClientMessage, { type: "updates" }>) => {
    if (stateVar() !== "playing") return;
    for (const { __delete, ...update } of data.updates) {
      if (update.id in map) Object.assign(map[update.id], update);
      else map[update.id] = app.addEntity(update);

      if (__delete) {
        app.removeEntity(map[update.id]);
        delete map[update.id];
      }
    }
  },
  leave: (data: Extract<ServerToClientMessage, { type: "leave" }>) => {
    const p = playersVar().find((p) => p.id === data.player);
    playersVar((players) =>
      players.filter((p) => p.id !== data.player).map((p) =>
        !p.host && data.host === p.id ? { ...p, host: true } : p
      )
    );
    if (p) addChatMessage(`${format(p)} has left the game!`);
    formatVar(data.format);
  },
  pong: ({ data }: Extract<ServerToClientMessage, { type: "pong" }>) => {
    if (typeof data === "number") {
      stats.msPanel.update(performance.now() - data, 100);
    }
  },
  chat: (
    { player, message }: Extract<ServerToClientMessage, { type: "chat" }>,
  ) => {
    const p = playersVar().find((p) => p.id === player);
    addChatMessage(p ? `|c${p.color}|${p.name}|: ${message}` : message);
  },
  lobbySettings: (
    { startingGold }: Extract<ServerToClientMessage, { type: "lobbySettings" }>,
  ) => {
    lobbySettingsVar({ startingGold });
  },
};
