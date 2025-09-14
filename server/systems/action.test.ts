import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderMove } from "../api/unit.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { yieldFor } from "@/server-testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "integration: sheep walking around a corner",
  { wolves: [], sheep: [] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 0.25, 0.25);
    newUnit("player-0", "hut", 1.25, 1.25);

    expect(sheep.position).toEqual({ x: 0.25, y: 0.25 });

    orderMove(sheep, { x: 2.25, y: 2 });

    expect(sheep.order).toEqual({
      type: "walk",
      target: { x: 2.25, y: 2 },
      path: [{ x: 2.25, y: 2 }],
    });

    yield* yieldFor(() => expect(sheep.position).toEqual({ x: 2.25, y: 2 }));
  },
);
