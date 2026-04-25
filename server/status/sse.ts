import { getAllClients } from "../client.ts";
import { lobbies } from "../lobby.ts";
import { onRoundEnded, onStatusChange } from "../statusStream.ts";
import {
  addRoundRecord,
  getPageLoadStats,
  type PageLoadStats,
  recentRounds,
  type RoundRecord,
} from "./storage.ts";
import { sendPushToAll } from "./push.ts";
import { getShardInfoList } from "../shardRegistry.ts";
import type { ShardInfo } from "@/shared/shard.ts";

const CLIENT_LIMIT = 50;

export const getPlayerCount = () => getAllClients().size;
export const getLobbyCount = () => lobbies.size;
export const getActiveRoundCount = () => {
  let n = 0;
  for (const lobby of lobbies) if (lobby.status === "playing") n++;
  return n;
};

export type ClientInfo = { name: string; lobby?: string };
export type LobbyInfo = {
  name: string;
  status: "lobby" | "playing";
  players: number;
  shard?: string;
};

const shardDisplayName = (id: string | undefined, shards: ShardInfo[]) => {
  if (!id) return undefined;
  const match = shards.find((s) => s.id === id);
  return match?.name ?? id;
};

export type StatusSnapshot = {
  players: number;
  lobbies: number;
  activeRounds: number;
  pageLoads: PageLoadStats;
  recentRounds: RoundRecord[];
  clients: ClientInfo[];
  lobbyList: LobbyInfo[];
  shards: ShardInfo[];
  ts: number;
};

const collectClients = (): ClientInfo[] => {
  const out: ClientInfo[] = [];
  for (const client of getAllClients()) {
    if (out.length >= CLIENT_LIMIT) break;
    out.push({ name: client.name, lobby: client.lobby?.name });
  }
  return out;
};

const collectLobbies = (shards: ShardInfo[]): LobbyInfo[] => {
  const out: LobbyInfo[] = [];
  for (const lobby of lobbies) {
    out.push({
      name: lobby.name,
      status: lobby.status,
      players: lobby.players.size,
      shard: shardDisplayName(
        lobby.activeShard ?? lobby.settings.shard,
        shards,
      ),
    });
  }
  return out;
};

const encoder = new TextEncoder();
const controllers = new Set<ReadableStreamDefaultController>();

const aggregateByShard = () => {
  const byShard = new Map<string, { players: number; lobbies: number }>();
  for (const lobby of lobbies) {
    const shardId = lobby.activeShard ?? lobby.settings.shard ?? "";
    const agg = byShard.get(shardId) ?? { players: 0, lobbies: 0 };
    agg.players += lobby.players.size;
    agg.lobbies += 1;
    byShard.set(shardId, agg);
  }
  return byShard;
};

const countHubPlayers = () => {
  let n = 0;
  for (const client of getAllClients()) if (!client.lobby) n++;
  return n;
};

const buildSnapshot = async (): Promise<StatusSnapshot> => {
  const rawShards = getShardInfoList();
  const players = getPlayerCount();
  const lobbyCount = getLobbyCount();
  const byShard = aggregateByShard();
  const hubPlayers = countHubPlayers();
  const shards = rawShards.map((s) => {
    const agg = byShard.get(s.id);
    if (s.id === "") {
      return {
        ...s,
        playerCount: (agg?.players ?? 0) + hubPlayers,
        lobbyCount: agg?.lobbies ?? 0,
      };
    }
    return {
      ...s,
      playerCount: agg?.players ?? 0,
      lobbyCount: agg?.lobbies ?? 0,
    };
  });
  return {
    players,
    lobbies: lobbyCount,
    activeRounds: getActiveRoundCount(),
    pageLoads: await getPageLoadStats(),
    recentRounds: await recentRounds(20),
    clients: collectClients(),
    lobbyList: collectLobbies(shards),
    shards,
    ts: Date.now(),
  };
};

const PUSH_THROTTLE_MS = 5 * 60 * 1000;
let lastPushAt = 0;
let lastPushedKey: string | undefined;
let lastPlayers = 0;
let lastActiveRounds = 0;

const pushKeyOf = (s: StatusSnapshot) =>
  `${s.players}|${s.lobbies}|${s.activeRounds}`;

const maybeSendPush = async (snapshot: StatusSnapshot) => {
  const key = pushKeyOf(snapshot);
  const isFirstPlayer = lastPlayers === 0 && snapshot.players > 0;
  const isFirstRound = lastActiveRounds === 0 && snapshot.activeRounds > 0;
  const sinceLast = Date.now() - lastPushAt;
  const throttledOk = sinceLast >= PUSH_THROTTLE_MS && key !== lastPushedKey;

  lastPlayers = snapshot.players;
  lastActiveRounds = snapshot.activeRounds;

  if (!isFirstPlayer && !isFirstRound && !throttledOk) return;

  lastPushAt = Date.now();
  lastPushedKey = key;
  await sendPushToAll({
    players: snapshot.players,
    lobbies: snapshot.lobbies,
    activeRounds: snapshot.activeRounds,
    reason: isFirstPlayer
      ? "first-player"
      : isFirstRound
      ? "first-round"
      : "update",
  });
};

const broadcast = async () => {
  const snapshot = await buildSnapshot();
  const data = JSON.stringify(snapshot);
  for (const controller of controllers) {
    try {
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch (err) {
      console.error(err);
      controllers.delete(controller);
    }
  }
  await maybeSendPush(snapshot);
};

const KEEPALIVE_MS = 15_000;
const KEEPALIVE_FRAME = encoder.encode(": ping\n\n");
setInterval(() => {
  for (const controller of controllers) {
    try {
      controller.enqueue(KEEPALIVE_FRAME);
    } catch {
      controllers.delete(controller);
    }
  }
}, KEEPALIVE_MS);

onRoundEnded((event) => {
  addRoundRecord(event).catch((err) =>
    console.error("[status] Failed to record round:", err)
  );
});

let statusChangeRegistered = false;
const registerStatusChangeOnce = () => {
  if (statusChangeRegistered) return;
  statusChangeRegistered = true;
  onStatusChange(() => {
    broadcast().catch((err) =>
      console.error("[status] broadcast failed:", err)
    );
  });
};

export const createStatusStream = async () => {
  registerStatusChangeOnce();
  const initial = JSON.stringify(await buildSnapshot());
  let ctrl: ReadableStreamDefaultController;
  const body = new ReadableStream({
    start(controller) {
      ctrl = controller;
      controllers.add(ctrl);
      ctrl.enqueue(encoder.encode(`data: ${initial}\n\n`));
    },
    cancel() {
      controllers.delete(ctrl);
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
};
