import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Entity } from "@/shared/types.ts";
import { newUnit, orderMove } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";

afterEach(cleanupTest);

const walkPath = (unit: Entity) =>
  unit.order?.type === "walk" ? unit.order.path : undefined;

it(
  "holds its plan rather than routing around a moving blocker",
  { sheep: ["player-0"] },
  function* () {
    const blocker = newUnit("player-0", "sheep", 40, 29.75);
    const walker = newUnit("player-0", "sheep", 40, 30.25);

    yield;

    orderMove(blocker, { x: 45, y: 29.75 });
    orderMove(walker, { x: 40, y: 27 });

    for (let tick = 0; tick < 40 && walker.position!.y > 27.5; tick++) {
      expect(walker.order?.type).toBe("walk");
      expect(walkPath(walker)?.every((point) => point.x === 40)).toBe(true);
      expect(walker.position!.x).toBeCloseTo(40);
      yield;
    }

    expect(walker.position!.y).toBeLessThan(27.5);
  },
);

it(
  "does not stall both units when they block each other",
  { sheep: ["player-0"] },
  function* () {
    const north = newUnit("player-0", "sheep", 40, 29);
    const south = newUnit("player-0", "sheep", 40, 31);

    yield;

    // Send them apart first, so that when the crossing orders are issued both
    // are already in motion and plan straight through each other. Ordering a
    // standing pair instead makes the first one plan a detour around the
    // second, which never produces the head-on case.
    orderMove(north, { x: 40, y: 26 });
    orderMove(south, { x: 40, y: 34 });

    yield;
    yield;

    orderMove(north, { x: 40, y: 34 });
    orderMove(south, { x: 40, y: 26 });

    // Neither may wait on the other, so they cannot both sit still for long.
    let frozen = 0;
    for (let tick = 0; tick < 80 && (north.order || south.order); tick++) {
      const before = [{ ...north.position! }, { ...south.position! }];

      yield;

      const stuck = north.position!.x === before[0].x &&
        north.position!.y === before[0].y &&
        south.position!.x === before[1].x &&
        south.position!.y === before[1].y;
      frozen = stuck ? frozen + 1 : 0;
      expect(frozen).toBeLessThanOrEqual(2);
    }

    expect(north.position!.y).toBeGreaterThan(33.5);
    expect(south.position!.y).toBeLessThan(26.5);
  },
);

it(
  "marks a unit blocked while it holds for a blocker",
  { sheep: ["player-0"] },
  function* () {
    const blocker = newUnit("player-0", "sheep", 40, 29.75);
    const walker = newUnit("player-0", "sheep", 40, 30.25);

    yield;

    orderMove(blocker, { x: 45, y: 29.75 });
    orderMove(walker, { x: 40, y: 27 });

    // A held unit writes nothing else, so a client is told it is holding and
    // stops predicting it forward rather than being snapped back later.
    let markedWhileHeld = false;
    let clearedOnResuming = false;

    for (let tick = 0; tick < 40; tick++) {
      const before = { ...walker.position! };

      yield;

      const held = walker.position!.x === before.x &&
        walker.position!.y === before.y;

      if (held && walker.blocked) markedWhileHeld = true;
      if (markedWhileHeld && !held) clearedOnResuming = !walker.blocked;
    }

    expect(markedWhileHeld).toBe(true);
    expect(clearedOnResuming).toBe(true);
  },
);

it(
  "routes around an enemy blocker instead of standing still for it",
  { sheep: ["player-0"], wolves: ["player-1"] },
  function* () {
    const wolf = newUnit("player-1", "wolf", 40, 29.75);
    const sheep = newUnit("player-0", "sheep", 40, 30.25);

    yield;

    orderMove(wolf, { x: 45, y: 29.75 });
    orderMove(sheep, { x: 40, y: 27 });

    // A wolf in the way is blocking on purpose and will not clear, so holding
    // for it hands it the block and stutters. Go round it and keep moving.
    let stalled = 0;
    let longestStall = 0;
    for (let tick = 0; tick < 80 && sheep.position!.y > 27.5; tick++) {
      expect(sheep.blocked).toBeFalsy();

      const before = { ...sheep.position! };

      yield;

      const still = sheep.position!.x === before.x &&
        sheep.position!.y === before.y;
      stalled = still ? stalled + 1 : 0;
      longestStall = Math.max(longestStall, stalled);
    }

    expect(sheep.position!.y).toBeLessThan(27.5);

    // Odd ticks spent turning to face the way round are fine; what reads as
    // stuttering is standing still for a stretch, over and over.
    expect(longestStall).toBeLessThanOrEqual(3);
  },
);

it(
  "does not hold for an enemy that steps into its path",
  { sheep: ["player-0"], wolves: ["player-1"] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 40, 32);

    yield;

    orderMove(sheep, { x: 40, y: 27 });

    // Let it commit to a path drawn while the way was clear.
    yield;
    yield;

    const wolf = newUnit("player-1", "wolf", 40, 30.5);

    yield;

    orderMove(wolf, { x: 45, y: 30.5 });

    // Waiting is a courtesy between allies passing through each other. An enemy
    // stepping in is not passing through, and holding for it is the stutter.
    let stalled = 0;
    let longestStall = 0;
    for (let tick = 0; tick < 80 && sheep.position!.y > 27.5; tick++) {
      const before = { ...sheep.position! };

      yield;

      const still = sheep.position!.x === before.x &&
        sheep.position!.y === before.y;
      stalled = still ? stalled + 1 : 0;
      longestStall = Math.max(longestStall, stalled);
    }

    expect(wolf.position).toBeTruthy();
    expect(longestStall).toBeLessThanOrEqual(3);
  },
);
