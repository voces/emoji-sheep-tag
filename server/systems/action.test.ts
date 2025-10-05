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

it(
  "integration: wolf attacking sheep (path movement)",
  { wolves: [], sheep: [] },
  function* () {
    const wolf = newUnit("player-1", "wolf", 20, 20);
    const sheep = newUnit("player-0", "sheep", 30, 20);

    // Give wolf an attack order (manually, since we're testing the movement part)
    wolf.order = { type: "attack", targetId: sheep.id };

    console.log("Initial wolf position:", wolf.position);
    console.log("Initial wolf order:", wolf.order);
    console.log("Wolf attack range:", wolf.attack?.range);

    // Wolf should start moving towards the sheep
    yield* yieldFor(0.5);

    console.log("After 0.5s wolf position:", wolf.position);
    console.log("After 0.5s wolf order:", wolf.order);

    // Wolf should have moved closer to sheep
    expect(wolf.position!.x).toBeGreaterThan(20);

    // Eventually wolf should reach attack range and attack
    yield* yieldFor(() => expect(wolf.swing).toBeDefined(), { timeout: 10 });
  },
);
