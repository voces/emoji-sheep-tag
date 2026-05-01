import type { ClientToServerMessage } from "../server/client.ts";
import { getWebSocket } from "./connection.ts";
import { getShardSocket } from "./shardConnection.ts";
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
// Note: "generic" and "cancel" go to primary server (lobby-level operations)
const SHARD_MESSAGE_TYPES = new Set([
  "build",
  "upgrade",
  "unitOrder",
  "ping",
  "mapPing",
  "chat",
  "purchase",
  "resetGold",
  "updateSelection",
]);

export const send = (message: ClientToServerMessage) => {
  // Track editor modifications
  if (
    message.type === "editorCreateEntity" ||
    message.type === "editorUpdateEntities" ||
    message.type === "editorSetPathing" ||
    message.type === "editorSetCliff" ||
    message.type === "editorBulkSetCliffs" ||
    message.type === "editorSetWater" ||
    message.type === "editorBulkSetWaters" ||
    message.type === "editorSetMask" ||
    message.type === "editorBulkSetMasks" ||
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

declare global {
  var latency: unknown;
  var noise: unknown;
}
