import type { ClientToServerMessage } from "../server/client.ts";
import { getWebSocket } from "./connection.ts";
import { getShardSocket } from "./shardConnection.ts";
import { flags } from "./flags.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { editorMapModifiedVar } from "@/vars/editor.ts";

const delay = (fn: () => void) => {
  if (typeof latency !== "number" && typeof noise !== "number") {
    return fn();
  }

  const delay = (typeof latency === "number" ? latency : 0) +
    (typeof noise === "number" ? Math.random() * noise : 0);
  setTimeout(fn, delay);
};

// Message types that should go through the shard during gameplay
// Note: "generic" goes to primary server (lobby-level operations)
// "cancel" goes to shard which then notifies primary to handle draft undo
const SHARD_MESSAGE_TYPES = new Set([
  "build",
  "upgrade",
  "unitOrder",
  "ping",
  "mapPing",
  "chat",
  "cancel",
  "purchase",
  "updateSelection",
]);

export const send = (message: ClientToServerMessage) => {
  // Track editor modifications
  if (
    message.type === "editorCreateEntity" ||
    message.type === "editorUpdateEntities" ||
    message.type === "editorSetPathing" ||
    message.type === "editorSetCliff" ||
    message.type === "editorResizeMap" ||
    message.type === "editorAdjustBounds"
  ) {
    editorMapModifiedVar(true);
  }

  delay(() => {
    try {
      // Route game messages through shard if connected
      const shardWs = getShardSocket();
      if (
        shardWs?.readyState === WebSocket.OPEN &&
        SHARD_MESSAGE_TYPES.has(message.type)
      ) {
        shardWs.send(JSON.stringify(message));
        return;
      }

      // Otherwise send through primary connection
      const ws = getWebSocket();
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  });
};

let pingInterval: number | undefined;

export const startPing = () => {
  // Clear any existing ping interval
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  pingInterval = setInterval(() => {
    if (
      (!flags.debug || !flags.debugStats) && !gameplaySettingsVar().showPing
    ) return;
    const ws = getWebSocket();
    if (ws?.readyState !== WebSocket.OPEN) return;
    const time = performance.now();
    send({ type: "ping", data: time });
  }, 1000);
};

export const stopPing = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = undefined;
  }
};

declare global {
  var latency: unknown;
  var noise: unknown;
}
