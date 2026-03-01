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
  { wolves: ["player-1"], sheep: ["player-0"] },
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

it("integration: wolf attacking sheep between huts", {
  sheep: ["player-0"],
  wolves: ["player-1"],
}, function* () {
  const sheep = newUnit("player-0", "sheep", 57.5, 36.75);
  const hut1 = newUnit("player-0", "hut", 57.5, 37.5);
  const hut2 = newUnit("player-0", "hut", 57.5, 36);
  const wolf = newUnit("player-1", "wolf", 53, 38.5, {
    facing: 5.497787143782135,
    order: { type: "attackMove", target: { x: 51, y: 40 }, targetId: sheep.id },
  });

  yield* yieldFor(() =>
    expect(
      [hut1.id, hut2.id],
    ).toContain(
      wolf.order && "targetId" in wolf.order ? wolf.order.targetId : undefined,
    ), { timeout: 10 });
  expect(sheep.health).toBe(20);
});
