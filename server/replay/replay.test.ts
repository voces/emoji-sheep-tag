import { beforeAll, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import revo from "@/shared/maps/revo.json" with { type: "json" };
import { appContext } from "@/shared/context.ts";
import { buildLoadedMap, type PackedMap } from "@/shared/map.ts";
import type { Entity } from "@/shared/types.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { systemsLoaded } from "../ecs.ts";
import { lobbies, newLobby } from "../lobby.ts";
import { gameActions, zGameMessage } from "../shard/gameClient.ts";
import { initializeGame, stepGame } from "../st/gameStartHelpers.ts";
import { handleMessage, wrapWithContext } from "../util/socketHandler.ts";
import type { Replay } from "./format.ts";
import { parseReplay, serializeReplay } from "./format.ts";
import { loadReplay } from "./load.ts";
import { takeRecording } from "./recorder.ts";
import { replayRound } from "./replay.ts";

const stubSocket = {
  readyState: WebSocket.OPEN,
  send: () => {},
  close: () => {},
  addEventListener: () => {},
};

/**
 * Plays a short survival round through the real message path and returns its
 * recording: the sheep walks and builds, the wolf chases, and the timer ends
 * the round.
 */
const recordRound = (): Replay => {
  const lobby = newLobby(undefined, true);
  lobby.settings = {
    ...lobby.settings,
    time: 30,
    startingGold: {
      sheep: 50,
      wolves: 0,
    },
  };
  lobby.status = "playing";
  const join = (id: string, team: "sheep" | "wolf") => {
    const client = new Client(stubSocket);
    Object.assign(client, { id, name: id, team });
    client.lobby = lobby;
    lobby.players.add(client);
    return client;
  };
  const sheep = join("s1", "sheep");
  const wolf = join("w1", "wolf");
  lobby.host = sheep;

  let ended = false;
  const round = lobbyContext.with(
    lobby,
    () =>
      clientContext.with(sheep, () =>
        initializeGame({
          map: buildLoadedMap("revo", revo as PackedMap),
          settings: lobby.settings,
          sheep: [sheep],
          wolves: [wolf],
          practice: false,
          editor: false,
          onSheepWin: () => ended = true,
          onWolvesWin: () => ended = true,
          manualTicks: true,
          recording: {
            host: "primary",
            packedMap: revo as PackedMap,
            always: true,
          },
        })),
  );
  const ecs = round.ecs;
  const clearInterval = round.clearInterval;
  round.clearInterval = () => {
    ended = true;
    clearInterval();
  };

  const send = (client: Client, message: Record<string, unknown>) =>
    wrapWithContext(
      client,
      (e: { data: unknown }) =>
        handleMessage(e, zGameMessage, gameActions, client),
    )({
      data: JSON.stringify(message),
    });
  const unitOf = (owner: string, prefab: string) =>
    Array.from(ecs.entities).find((e: Entity) =>
      e.owner === owner && e.prefab === prefab
    );

  while (!ended && ecs.tick < 2000) {
    lobbyContext.with(lobby, () => appContext.with(ecs, () => stepGame(ecs)));

    const sheepUnit = unitOf("s1", "sheep");
    if (sheepUnit?.position && ecs.tick % 40 === 0) {
      const { x, y } = sheepUnit.position;
      const step = ecs.tick / 40;
      send(sheep, {
        type: "build",
        unit: sheepUnit.id,
        buildType: "hut",
        x: Math.round(x) + (step % 3) - 1,
        y: Math.round(y) + 2,
      });
      send(sheep, {
        type: "unitOrder",
        units: [sheepUnit.id],
        order: "move",
        target: { x: x + (step % 2 ? 3 : -3), y: y + 1 },
        queue: true,
      });
    }

    const wolfUnit = unitOf("w1", "wolf");
    if (wolfUnit && sheepUnit?.position && ecs.tick % 25 === 0) {
      send(wolf, {
        type: "unitOrder",
        units: [wolfUnit.id],
        order: "attack",
        target: sheepUnit.id,
      });
    }
  }

  round.clearInterval();
  const replay = takeRecording(ecs)!;
  lobbies.delete(lobby);
  return replay;
};

describe("replay", () => {
  let recording: Replay;
  beforeAll(async () => {
    await systemsLoaded;
    recording = recordRound();
  });

  it("records inputs, checkpoints, and the round's end", () => {
    const kinds = recording.events.map((e) => e.k);
    expect(kinds.filter((k) => k === "msg").length).toBeGreaterThan(10);
    expect(kinds.filter((k) => k === "hash").length).toBeGreaterThan(10);
    expect(recording.events.at(-1)).toMatchObject({ k: "end" });
  });

  it("reproduces the recorded round exactly", () => {
    const result = replayRound(recording);
    expect(result.firstDivergence).toBeUndefined();
    expect(result.checkpoints).toBe(
      recording.events.filter((e) => e.k === "hash").length,
    );
    expect(result.ticks).toBe(result.recordedEndTick);
    expect(result.winner).toBe(result.recordedWinner);
    expect(result.skipped).toEqual({});
  });

  it("survives a round trip through the file format", () => {
    const result = replayRound(parseReplay(serializeReplay(recording)));
    expect(result.firstDivergence).toBeUndefined();
  });

  it("reports the first checkpoint after the inputs diverge", () => {
    const tampered = structuredClone(recording);
    const index = tampered.events.findIndex((e) =>
      e.k === "msg" && e.d.includes('"move"')
    );
    const event = tampered.events[index];
    if (event.k !== "msg") throw new Error("expected a move order");
    const message = JSON.parse(event.d);
    message.target.x += 4;
    event.d = JSON.stringify(message);

    const result = replayRound(tampered);
    expect(result.firstDivergence).toBeDefined();
    expect(result.firstDivergence!.tick).toBeGreaterThanOrEqual(event.t);
  });
});

// A real recorded round. Its recorded hashes stop matching whenever gameplay
// changes, so this checks only that it replays the same way every time.
it("replays a recorded round identically every run", async () => {
  await systemsLoaded;
  const replay = await loadReplay(
    new URL("./fixtures/revo-practice.jsonl.gz", import.meta.url),
  );
  const run = () => replayRound(replay, { stopOnDivergence: false });
  const [first, second] = [run(), run()];

  expect(first.ticks).toBeGreaterThan(1000);
  expect(second.ticks).toBe(first.ticks);
  expect(second.hashes).toEqual(first.hashes);
});
