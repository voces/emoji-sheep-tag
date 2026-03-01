import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { yieldFor } from "../../testing/yieldFor.ts";
import { calcPath } from "../pathing.ts";

afterEach(cleanupTest);

it(
  "calcPath should not include the target object's extra properties in path",
  { sheep: ["player-0"] },
  function* () {
    // Create a sheep
    const sheep = newUnit("player-0", "sheep", 38, 30);

    yield;

    // Simulate a build order with extra properties (like a real order object)
    // This reproduces the bug where calcPath is passed an order object as target
    // (e.g., in advanceBuild.ts: calcPath(e, e.order, ...))
    const orderTarget = {
      type: "build",
      x: 40.5,
      y: 30,
      unitType: "hut",
      path: [{ x: 39, y: 30 }],
    };

    const path = calcPath(sheep, orderTarget, { distanceFromTarget: 0.8 });

    // Path should only contain {x, y} points, not the full order object
    for (const point of path) {
      const keys = Object.keys(point);
      expect(keys.every((k) => k === "x" || k === "y")).toBe(true);
    }
  },
);

it(
  "should not trigger order loop when two sheep try to build at same location",
  { wolves: ["player-1"], sheep: ["player-0", "player-2"] },
  function* () {
    const sheep1 = newUnit("player-0", "sheep", 38, 30);
    const sheep2 = newUnit("player-2", "sheep", 38.5, 30);

    let loopWarningCount = 0;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" && args[0].includes("Over 10 order loops")
      ) {
        loopWarningCount++;
      }
      originalWarn(...args);
    };

    orderBuild(sheep1, "hut", 40.5, 30);
    orderBuild(sheep2, "hut", 40.5, 30);

    yield* yieldFor(5);

    console.warn = originalWarn;
    expect(loopWarningCount).toBe(0);
  },
);
