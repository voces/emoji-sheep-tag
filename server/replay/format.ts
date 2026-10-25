import type { PackedMap } from "@/shared/map.ts";
import type { Lobby } from "../lobby.ts";

export const REPLAY_FORMAT = "est-replay";
export const REPLAY_FORMAT_VERSION = 1;

export type ReplayPlayer = {
  id: string;
  name: string;
  playerColor: string;
  team?: "sheep" | "wolf" | "pending" | "observer";
  handicap?: number;
  sheepCount?: number;
  sheepTime?: number;
  gold?: number;
  startLocation?: { x: number; y: number; map: string };
  isComputer?: boolean;
};

/**
 * Everything `initializeGame` reads, captured before it runs. Players are
 * snapshotted because the round mutates them (VIP handicaps, teams).
 */
export type ReplayHeader = {
  format: typeof REPLAY_FORMAT;
  formatVersion: typeof REPLAY_FORMAT_VERSION;
  gameVersion: string;
  recordedAt: string;
  /** Which server ran the round; the two handle a player leaving differently. */
  host: "primary" | "shard";
  seed: number;
  map: { id: string; name: string; packed: PackedMap };
  settings: Lobby["settings"];
  /** Every lobby player, observers included, in lobby order. */
  players: ReplayPlayer[];
  sheep: string[];
  wolves: string[];
  practice: boolean;
  hostId?: string;
  /** The client whose context the tick loop runs in, if any. */
  tickClient?: string;
  sheepCaptainId?: string;
  /** Ticks between `hash` events; 0 records none. */
  checksumInterval: number;
};

/**
 * `t` is the tick count when the event happened. A message stamped `t` arrived
 * after tick `t` ran and before tick `t + 1`; events are in arrival order.
 */
export type ReplayEvent =
  | { k: "msg"; t: number; p: string; d: string }
  | { k: "leave"; t: number; p: string }
  | { k: "hash"; t: number; h: string }
  | { k: "end"; t: number; winner?: "sheep" | "wolves" };

export type Replay = { header: ReplayHeader; events: ReplayEvent[] };

/** Message types that cannot change simulation state are not recorded. */
export const UNRECORDED_MESSAGES: ReadonlySet<string> = new Set([
  "chat",
  "ping",
]);

/** One JSON document per line: the header, then each event. */
export const serializeReplay = ({ header, events }: Replay) =>
  [header, ...events].map((line) => JSON.stringify(line)).join("\n") + "\n";

export const parseReplay = (text: string): Replay => {
  const [headerLine, ...eventLines] = text.split("\n").filter((l) => l);
  const header = JSON.parse(headerLine) as ReplayHeader;
  if (header.format !== REPLAY_FORMAT) throw new Error("Not a replay file");
  if (header.formatVersion !== REPLAY_FORMAT_VERSION) {
    throw new Error(`Unsupported replay format ${header.formatVersion}`);
  }
  return {
    header,
    events: eventLines.map((line) => JSON.parse(line) as ReplayEvent),
  };
};
