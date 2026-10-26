import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { yieldFor } from "../../testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "turns to face an unreachable target without looping its order",
  { sheep: ["player-0"] },
  function* () {
    // A closed ring of fences around (45, 30); from (46.5, 30) the sheep can
    // get no closer, so its path there is empty and it only turns to face it
    for (let x = 44; x <= 46; x += 0.5) {
      newUnit("player-0", "fence", x, 29);
      newUnit("player-0", "fence", x, 31);
    }
    for (let y = 29.5; y <= 30.5; y += 0.5) {
      newUnit("player-0", "fence", 44, y);
      newUnit("player-0", "fence", 46, y);
    }
    const sheep = newUnit("player-0", "sheep", 46.5, 30);
    yield;

    // Facing just shy of the target, with a stale waypoint on its far side:
    // turning toward the waypoint spends the tick's turn before the repath
    // finds there is no path
    const toTarget = Math.PI;
    const toWaypoint = toTarget + 0.84;
    sheep.facing = toTarget - 0.06;
    sheep.order = {
      type: "walk",
      target: { x: 45, y: 30 },
      path: [{
        x: 46.5 + Math.cos(toWaypoint),
        y: 30 + Math.sin(toWaypoint),
      }],
      lastRepath: 0,
    };

    let loopWarnings = 0;
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("order loops")) {
        loopWarnings++;
      }
      warn(...args);
    };
    try {
      yield* yieldFor(() => expect(sheep.order).toBeUndefined());
    } finally {
      console.warn = warn;
    }

    expect(loopWarnings).toBe(0);
    expect(sheep.facing).toBeCloseTo(toTarget, 1);
  },
);
