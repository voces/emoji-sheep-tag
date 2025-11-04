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
    const sheep = newUnit("player-0", "sheep", 30.25, 30.25);
    newUnit("player-0", "hut", 31.25, 31.25);

    expect(sheep.position).toEqual({ x: 30.25, y: 30.25 });

    orderMove(sheep, { x: 32.25, y: 32 });

    expect(sheep.order).toEqual({
      type: "walk",
      target: { x: 32.25, y: 32 },
      path: [{ x: 32.25, y: 32 }],
    });

    yield* yieldFor(() => expect(sheep.position).toEqual({ x: 32.25, y: 32 }));
  },
);

it(
  "integration: wolf attacking sheep (path movement)",
  { wolves: [], sheep: [] },
  function* () {
    const wolf = newUnit("player-1", "wolf", 20, 20);
    const sheep = newUnit("player-0", "sheep", 30, 20);

    // Give wolf an attack order (manually, since we're testing the movement part)
    wolf.order = { type: "attack", targetId: sheep.id };

    // Wolf should start moving towards the sheep
    yield* yieldFor(0.5);

    // Wolf should have moved closer to sheep
    expect(wolf.position!.x).toBeGreaterThan(20);

    // Eventually wolf should reach attack range and attack
    yield* yieldFor(() => expect(wolf.swing).toBeDefined(), { timeout: 10 });
  },
);
