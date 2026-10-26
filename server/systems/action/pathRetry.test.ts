import { afterEach, expect } from "vitest";
import { newUnit, orderMove } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { handleBlockedPath } from "./pathRetry.ts";

afterEach(cleanupTest);

// A blocker that has nearly moved off reads as clear to the planner, which
// works in quarter tiles, while the walker still collides with it: the plan
// comes back unchanged, and the walker should wait for it rather than give up.
it(
  "waits rather than cancels when the plan comes back unchanged",
  { sheep: ["player-0"] },
  function* () {
    const walker = newUnit("player-0", "sheep", 40, 30);
    yield;
    orderMove(walker, { x: 40, y: 27 });
    const path = [{ x: 40, y: 27 }];

    expect(handleBlockedPath(walker, { x: 40, y: 27 }, path)).toBe("wait");
  },
);

it(
  "gives up once the plan has kept coming back unchanged for two seconds",
  { sheep: ["player-0"] },
  function* () {
    const walker = newUnit("player-0", "sheep", 40, 30);
    yield;
    orderMove(walker, { x: 40, y: 27 });
    const path = [{ x: 40, y: 27 }];

    const outcomes: string[] = [];
    for (let tick = 0; tick <= 40; tick++) {
      outcomes.push(handleBlockedPath(walker, { x: 40, y: 27 }, path));
      yield;
    }

    expect(outcomes.slice(0, 40).every((o) => o === "wait")).toBe(true);
    expect(outcomes[40]).toBe("cancel");
  },
);
