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
    const sheep = newUnit("player-0", "sheep", 20.25, 20.25);
    newUnit("player-0", "hut", 21.25, 21.25);

    expect(sheep.position).toEqual({ x: 20.25, y: 20.25 });

    orderMove(sheep, { x: 22.25, y: 22 });

    expect(sheep.order).toEqual({
      type: "walk",
      target: { x: 22.25, y: 22 },
      path: [{ x: 22.25, y: 22 }],
    });

    yield* yieldFor(() => expect(sheep.position).toEqual({ x: 22.25, y: 22 }));
  },
);
