import z from "zod";
import { connectionStatusVar } from "@/vars/state.ts";
import { LocalWebSocket } from "./local.ts";
import { getStoredPlayerName } from "./util/playerPrefs.ts";
import { handlers } from "./messageHandlers.ts";
import { type ServerToClientMessage, zMessage } from "./schemas.ts";
import { send as _send } from "./messaging.ts";

let ws: WebSocket | LocalWebSocket | undefined;
let reconnectTimeout: number | undefined;
const delayTimeouts: Set<number> = new Set();
let testCleanupMode = false;
let userStoppedReconnecting = false;

const delay = (fn: () => void) => {
  if (typeof latency !== "number" && typeof noise !== "number") {
    return fn();
  }

  const delay = (typeof latency === "number" ? latency : 0) +
    (typeof noise === "number" ? Math.random() * noise : 0);
  const timeoutId = setTimeout(() => {
    delayTimeouts.delete(timeoutId);
    fn();
  }, delay);
  delayTimeouts.add(timeoutId);
};

let server = location?.host || "localhost:8080";
export const setServer = (value: string) => server = value;

export const connect = () => {
  if (ws) return;

  // Reset user stop flag when manually connecting
  userStoppedReconnecting = false;

  // Get stored name for initial connection
  const storedName = getStoredPlayerName();
  const nameParam = storedName ? `?name=${encodeURIComponent(storedName)}` : "";

  // Use LocalWebSocket for offline mode, regular WebSocket otherwise
  ws = server === "local"
    ? new LocalWebSocket(storedName || undefined)
    : new WebSocket(
      `ws${location?.protocol === "https:" ? "s" : ""}://${server}${nameParam}`,
    );

  ws.addEventListener("close", () => {
    ws = undefined;

    if (userStoppedReconnecting) return;

    connectionStatusVar("disconnected");
    ws = undefined;
    // Auto-reconnect unless in test environment or during test cleanup
    if (!server.includes("localhost:8888") && !testCleanupMode) {
      reconnectTimeout = setTimeout(connect, 1000);
    }
  });

  ws.addEventListener("open", () => {
    connectionStatusVar("connected");
  });

  ws.addEventListener("message", (e) => {
    const json = JSON.parse(e.data);
    let data: ServerToClientMessage;
    try {
      data = zMessage.parse(json);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(json);
        console.error(...err.issues);
      }
      throw err;
    }

    delay(() => handlers[data.type](data as never));
  });
};

export const getWebSocket = () =>
  ws as { readyState: number; send: (data: string) => void } | undefined;

export const stopReconnecting = () => {
  userStoppedReconnecting = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }
};

// Test utility to reset connection state
export const resetConnection = () => {
  // Set test cleanup mode to prevent auto-reconnect
  testCleanupMode = true;

  // Clear any pending reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }

  // Clear all pending delay timeouts
  for (const timeoutId of delayTimeouts) {
    clearTimeout(timeoutId);
  }
  delayTimeouts.clear();

  if (ws && ws.readyState !== 3) { // 3 = CLOSED
    ws.close?.();
  }
  ws = undefined;

  // Reset test cleanup mode for next test
  setTimeout(() => testCleanupMode = false, 0);
};

declare global {
  var latency: unknown;
  var noise: unknown;
}
