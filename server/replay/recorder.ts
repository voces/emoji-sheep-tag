import { appContext } from "@/shared/context.ts";
import { VERSION } from "@/shared/version.ts";
import type { Game } from "../ecs.ts";
import { clientContext } from "../contexts.ts";
import {
  type Replay,
  REPLAY_FORMAT,
  REPLAY_FORMAT_VERSION,
  type ReplayEvent,
  type ReplayHeader,
  serializeReplay,
  UNRECORDED_MESSAGES,
} from "./format.ts";
import { hashState } from "./stateHash.ts";

type Recording = {
  header: ReplayHeader;
  events: ReplayEvent[];
  winner?: "sheep" | "wolves";
  lobbyName: string;
};

const recordings = new WeakMap<Game, Recording>();

// This module is also bundled into the browser's local server, so it uses only
// web APIs and a guarded Deno global
const env = (key: string) =>
  typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;

/** Recording is on when REPLAY_DIR names a directory to write replays to. */
export const replayDir = () => env("REPLAY_DIR") || undefined;

const checksumInterval = () => {
  const ticks = Number(env("REPLAY_CHECKSUM_TICKS") ?? 20);
  return Number.isInteger(ticks) && ticks >= 0 ? ticks : 20;
};

export const startRecording = (
  ecs: Game,
  lobbyName: string,
  header: Omit<
    ReplayHeader,
    | "format"
    | "formatVersion"
    | "gameVersion"
    | "recordedAt"
    | "seed"
    | "checksumInterval"
  >,
) =>
  void recordings.set(ecs, {
    lobbyName,
    events: [],
    header: {
      format: REPLAY_FORMAT,
      formatVersion: REPLAY_FORMAT_VERSION,
      gameVersion: VERSION,
      recordedAt: new Date().toISOString(),
      seed: ecs.seed,
      checksumInterval: checksumInterval(),
      ...structuredClone(header),
    },
  });

const current = () => {
  const app = appContext.maybeCurrent as Game | undefined;
  return app ? { app, recording: recordings.get(app) } : undefined;
};

/** Records an inbound message for the round in the current app context. */
export const recordMessage = (type: string, data: string) => {
  const { app, recording } = current() ?? {};
  const player = clientContext.maybeCurrent?.id;
  if (!app || !recording || !player || UNRECORDED_MESSAGES.has(type)) return;
  recording.events.push({ k: "msg", t: app.tick, p: player, d: data });
};

export const recordLeave = (player: string) => {
  const { app, recording } = current() ?? {};
  if (!app || !recording) return;
  recording.events.push({ k: "leave", t: app.tick, p: player });
};

/** Call once the tick's batch has flushed. */
export const recordTick = (ecs: Game) => {
  const recording = recordings.get(ecs);
  if (!recording) return;
  const interval = recording.header.checksumInterval;
  if (interval && ecs.tick % interval === 0) {
    recording.events.push({ k: "hash", t: ecs.tick, h: hashState(ecs) });
  }
};

export const recordWinner = (ecs: Game, winner: "sheep" | "wolves") => {
  const recording = recordings.get(ecs);
  if (recording) recording.winner = winner;
};

const gzip = (text: string) =>
  new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream("gzip")),
  ).bytes();

/** Ends the recording and returns it, if the round was being recorded. */
export const takeRecording = (ecs: Game): Replay | undefined => {
  const recording = recordings.get(ecs);
  if (!recording) return;
  recordings.delete(ecs);
  recording.events.push({ k: "end", t: ecs.tick, winner: recording.winner });
  return { header: recording.header, events: recording.events };
};

/**
 * Ends the recording and writes it to REPLAY_DIR; failures are logged, not
 * thrown. Without REPLAY_DIR the recording is left for `takeRecording`.
 */
export const finishRecording = (ecs: Game) => {
  const dir = replayDir();
  if (!dir) return;
  const lobbyName = recordings.get(ecs)?.lobbyName ?? "";
  const replay = takeRecording(ecs);
  if (!replay) return;

  const stamp = replay.header.recordedAt.replace(/[:.]/g, "-");
  const lobby = lobbyName.replace(/[^A-Za-z0-9_-]/g, "_");
  const path = `${dir}/${stamp}-${lobby}-${ecs.seed}.jsonl.gz`;
  const text = serializeReplay(replay);
  (async () => {
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeFile(path, await gzip(text));
  })().catch((err) => console.error("[replay] Failed to write", path, err));
};
