import type { ClientToServerMessage } from "../server/client.ts";
import { getWebSocket } from "./connection.ts";

const delay = (fn: () => void) => {
  if (typeof latency !== "number" && typeof noise !== "number") {
    return fn();
  }

  const delay = (typeof latency === "number" ? latency : 0) +
    (typeof noise === "number" ? Math.random() * noise : 0);
  setTimeout(fn, delay);
};

export const send = (message: ClientToServerMessage) => {
  delay(() => {
    try {
      const ws = getWebSocket();
      if (ws?.readyState === 1) { // 1 = OPEN
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
    const ws = getWebSocket();
    if (ws?.readyState !== 1) return; // 1 = OPEN
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
