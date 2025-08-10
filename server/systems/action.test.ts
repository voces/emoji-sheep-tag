import { afterEach, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { Entity } from "@/shared/types.ts";
import { waitFor } from "@/shared/util/test/waitFor.ts";
import { interval } from "../api/timing.ts";
import { orderMove } from "../api/unit.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newEcs } from "../ecs.ts";
import { newLobby } from "../lobby.ts";
import { prefabs } from "@/shared/data.ts";

afterEach(() => {
  try {
    lobbyContext.context.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
});

const setup = () => {
  const ecs = newEcs();
  const client = new Client({
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    addEventListener: () => {},
  });
  clientContext.context = client;
  const lobby = newLobby();
  lobbyContext.context = lobby;
  lobby.round = {
    sheep: new Set(),
    wolves: new Set(),
    ecs,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  return ecs;
};

it("integration: sheep walking around a corner", async () => {
  const ecs = setup();

  const sheep = ecs.addEntity<Entity>({
    ...prefabs.sheep,
    id: "sheep-0",
    radius: 0.25,
    position: { x: 0.25, y: 0.25 },
    pathing: 1,
  });
  ecs.addEntity({
    id: "hut-0",
    radius: 0.5,
    tilemap: { map: Array(16).fill(3), top: -2, left: -2, width: 4, height: 4 },
    position: { x: 1.25, y: 1.25 },
    pathing: 1,
  });

  expect(sheep.position).toEqual({ x: 0.25, y: 0.25 });

  orderMove(sheep, { x: 2.25, y: 2 });

  expect(sheep.position).toEqual({ x: 0.25, y: 0.25 });
  expect(sheep.order).toEqual({
    type: "walk",
    target: { x: 2.25, y: 2 },
    path: [{ x: 2, y: 0.5 }, { x: 2.25, y: 2 }],
  });

  await waitFor(() => expect(sheep.position).toEqual({ x: 2.25, y: 2 }));
});
