import { getWebSocket } from "./connection.ts";
import { getShardSocket } from "./shardConnection.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { stats } from "./util/Stats.ts";

const PING_INTERVAL_MS = 1000;

// HTTP probe to a shard's /ping endpoint, used when a shard is selected but no
// game is active.
let httpTarget: string | undefined;
let httpInFlight = false;

const buildHttpPingUrl = (publicUrl: string) => {
  const url = new URL(publicUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/ping";
  url.search = "";
  return url.toString();
};

const httpProbe = async () => {
  if (httpInFlight || !httpTarget) return;
  if (!uiSettingsVar().showPing) return;
  httpInFlight = true;
  const start = performance.now();
  try {
    const res = await fetch(httpTarget, { cache: "no-store" });
    if (res.ok) stats.msPanel.update(performance.now() - start);
  } catch {
    /* network errors are normal during shard transitions */
  } finally {
    httpInFlight = false;
  }
};

const syncHttpTarget = () => {
  const settings = lobbySettingsVar();
  const shard = settings.shard
    ? settings.shards.find((s) => s.id === settings.shard)
    : undefined;
  const next = shard?.status === "online" && shard.publicUrl
    ? buildHttpPingUrl(shard.publicUrl)
    : undefined;
  httpTarget = next;
};

let pingInterval: number | undefined;
let unsubscribe: (() => void) | undefined;

export const startPing = () => {
  if (pingInterval !== undefined) clearInterval(pingInterval);
  unsubscribe?.();
  unsubscribe = lobbySettingsVar.subscribe(syncHttpTarget);
  syncHttpTarget();

  pingInterval = setInterval(() => {
    if (!uiSettingsVar().showPing) return;

    // Active game shard wins — ping over the same socket the game uses.
    const gameShard = getShardSocket();
    if (gameShard?.readyState === WebSocket.OPEN) {
      gameShard.send(JSON.stringify({ type: "ping", data: performance.now() }));
      return;
    }

    // Selected online shard — measure RTT via HTTP.
    if (httpTarget) {
      httpProbe();
      return;
    }

    // Fall back to the primary connection.
    const ws = getWebSocket();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ping", data: performance.now() }));
    }
  }, PING_INTERVAL_MS);
};

export const stopPing = () => {
  if (pingInterval !== undefined) {
    clearInterval(pingInterval);
    pingInterval = undefined;
  }
  unsubscribe?.();
  unsubscribe = undefined;
  httpTarget = undefined;
};

export const getCurrentPingTarget = ():
  | "shard-game"
  | "shard-ping"
  | "primary"
  | "none" => {
  const gameShard = getShardSocket();
  if (gameShard?.readyState === WebSocket.OPEN) return "shard-game";
  if (httpTarget) return "shard-ping";
  const ws = getWebSocket();
  if (ws?.readyState === WebSocket.OPEN) return "primary";
  return "none";
};
