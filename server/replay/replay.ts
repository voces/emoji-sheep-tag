import { buildLoadedMap } from "@/shared/map.ts";
import { appContext } from "@/shared/context.ts";
import { Client, getAllClients } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import type { Game } from "../ecs.ts";
import { lobbies, newLobby } from "../lobby.ts";
import { removeLeavingPlayer } from "../lobbyApi.ts";
import { removePlayerFromEcs } from "../api/player.ts";
import { gameActions, zGameMessage } from "../shard/gameClient.ts";
import { initializeGame, stepGame } from "../st/gameStartHelpers.ts";
import { flushUpdates } from "../updates.ts";
import { handleMessage, wrapWithContext } from "../util/socketHandler.ts";
import type { Replay } from "./format.ts";
import { hashState } from "./stateHash.ts";

export type ReplayOptions = {
  /** Stop at the first checkpoint whose hash differs from the recording. */
  stopOnDivergence?: boolean;
  /** Time each system's update separately (adds a little overhead). */
  profileSystems?: boolean;
  /** Called at each checkpoint, e.g. to dump `canonicalState` for a diff. */
  onCheckpoint?: (tick: number, ecs: Game) => void;
};

export type Divergence = { tick: number; expected: string; actual: string };

export type ReplayResult = {
  /** Ticks run, and the tick the recording ended on. */
  ticks: number;
  recordedEndTick?: number;
  recordedWinner?: "sheep" | "wolves";
  winner?: "sheep" | "wolves";
  checkpoints: number;
  firstDivergence?: Divergence;
  /** Recorded hash per checkpoint tick, as this run computed it. */
  hashes: Map<number, string>;
  /** Message types the replay cannot dispatch, with counts. */
  skipped: Record<string, number>;
  timing: {
    /** Wall ms per tick: update, system callbacks, and update serialization. */
    tickMs: number[];
    /** Wall ms spent dispatching recorded messages and leaves. */
    inputMs: number;
    /** Wall ms per system's `update`/`updateEntity`, when profiled. */
    systemMs: Map<string, number>;
  };
};

const stubSocket = {
  readyState: WebSocket.OPEN,
  send: () => {},
  close: () => {},
  addEventListener: () => {},
};

const systemLabel = (system: unknown) => {
  const trace = (system as { trace?: string }).trace ?? "";
  // addSystem records its caller's stack; the third line names the module
  const frame = trace.split("\n")[2] ?? "";
  const match = frame.match(/([^/\\]+\/[^/\\]+\.tsx?):(\d+)/);
  return match ? `${match[1]}:${match[2]}` : "unknown";
};

/**
 * Replaces `ecs.update` with an equivalent loop that times each system. Keeps
 * the library's order and arguments so the simulation is unchanged.
 */
const profileSystems = (ecs: Game, systemMs: Map<string, number>) => {
  const labels = new Map<unknown, string>();
  ecs.update = (delta?: number) =>
    ecs.batch(() => {
      const step = delta ?? 0;
      const next = ecs.lastUpdate + step;
      ecs.lastUpdate = next;
      for (const system of ecs.systems) {
        const start = performance.now();
        system.update?.(step, next);
        if (system.updateEntity) {
          for (const child of system.entities) {
            system.updateEntity(child, step, next);
          }
        }
        let label = labels.get(system);
        if (!label) labels.set(system, label = systemLabel(system));
        systemMs.set(
          label,
          (systemMs.get(label) ?? 0) + performance.now() - start,
        );
      }
    });
};

/**
 * Re-runs a recorded round headlessly, as fast as it will go, feeding each
 * recorded input in at the tick it arrived. Verifies the recording's
 * checkpoint hashes along the way.
 */
export const replayRound = (
  { header, events }: Replay,
  options: ReplayOptions = {},
): ReplayResult => {
  const { stopOnDivergence = true } = options;

  const lobby = newLobby(undefined, true);
  lobby.settings = structuredClone(header.settings);
  lobby.status = "playing";

  const clients = new Map<string, Client>();
  for (const player of header.players) {
    const client = new Client(stubSocket);
    Object.assign(client, {
      id: player.id,
      name: player.name,
      playerColor: player.playerColor,
      team: player.team ?? "pending",
      handicap: player.handicap,
      sheepCount: player.sheepCount ?? 0,
      ...(player.isComputer ? { isComputer: true } : {}),
    });
    client.startLocation = player.startLocation;
    client.lobby = lobby;
    lobby.players.add(client);
    clients.set(player.id, client);
  }
  lobby.host = header.hostId ? clients.get(header.hostId) : undefined;

  const playersOf = (ids: string[]) =>
    ids.map((id) => {
      const client = clients.get(id);
      if (!client) throw new Error(`Replay names unknown player ${id}`);
      return client;
    });

  const tickClient = header.tickClient
    ? clients.get(header.tickClient)
    : undefined;
  const withTickClient = <T>(fn: () => T) =>
    tickClient ? clientContext.with(tickClient, fn) : fn();

  let winner: "sheep" | "wolves" | undefined;
  // Every way a round ends (a win, a wipe, a timer) clears its interval; a
  // win ends it too, as `endRound` does live
  let ended = false;
  const round = lobbyContext.with(
    lobby,
    () =>
      withTickClient(() =>
        initializeGame({
          map: buildLoadedMap(header.map.id, header.map.packed, {
            name: header.map.name,
          }),
          settings: lobby.settings,
          sheep: playersOf(header.sheep),
          wolves: playersOf(header.wolves),
          practice: header.practice,
          editor: false,
          onSheepWin: () => {
            winner = "sheep";
            ended = true;
          },
          onWolvesWin: () => {
            winner = "wolves";
            ended = true;
          },
          sheepCaptainId: header.sheepCaptainId,
          seed: header.seed,
          manualTicks: true,
        })
      ),
  );
  const ecs = round.ecs;

  const clearInterval = round.clearInterval;
  round.clearInterval = () => {
    ended = true;
    clearInterval();
  };

  const result: ReplayResult = {
    ticks: 0,
    checkpoints: 0,
    hashes: new Map(),
    skipped: {},
    timing: { tickMs: [], inputMs: 0, systemMs: new Map() },
  };
  if (options.profileSystems) profileSystems(ecs, result.timing.systemMs);

  const tick = () => {
    const start = performance.now();
    lobbyContext.with(lobby, () => {
      appContext.with(ecs, () => withTickClient(() => stepGame(ecs)));
      flushUpdates();
    });
    result.timing.tickMs.push(performance.now() - start);
    result.ticks = ecs.tick;
  };

  const dispatch = (client: Client, data: string) => {
    const { type } = JSON.parse(data) as { type: string };
    if (!(type in gameActions)) {
      result.skipped[type] = (result.skipped[type] ?? 0) + 1;
      return;
    }
    wrapWithContext(
      client,
      (e: { data: unknown }) =>
        handleMessage(e, zGameMessage, gameActions, client),
    )({ data });
  };

  const leave = (client: Client) => {
    lobbyContext.with(
      lobby,
      () =>
        appContext.with(ecs, () =>
          clientContext.with(client, () => {
            ecs.batch(() =>
              header.host === "primary"
                ? removeLeavingPlayer(client)
                : removePlayerFromEcs(client.id)
            );
            flushUpdates();
          })),
    );
    lobby.players.delete(client);
  };

  try {
    for (const event of events) {
      while (ecs.tick < event.t && !ended) tick();
      if (ended && ecs.tick < event.t) break;

      if (event.k === "end") {
        result.recordedEndTick = event.t;
        result.recordedWinner = event.winner;
        break;
      }

      if (event.k === "hash") {
        options.onCheckpoint?.(event.t, ecs);
        const actual = hashState(ecs);
        result.hashes.set(event.t, actual);
        result.checkpoints++;
        if (actual !== event.h && !result.firstDivergence) {
          result.firstDivergence = {
            tick: event.t,
            expected: event.h,
            actual,
          };
          if (stopOnDivergence) break;
        }
        continue;
      }

      const client = clients.get(event.p);
      if (!client) throw new Error(`Replay names unknown player ${event.p}`);
      const start = performance.now();
      if (event.k === "msg") dispatch(client, event.d);
      else leave(client);
      result.timing.inputMs += performance.now() - start;
    }
  } finally {
    round.clearInterval();
    lobbies.delete(lobby);
    for (const client of clients.values()) getAllClients().delete(client);
  }

  result.winner = winner;
  return result;
};
