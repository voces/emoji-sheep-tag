import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { yieldFor } from "../../testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "wolf should not loop infinitely when attacking with continuous repathing",
  { wolves: ["player-1"], sheep: ["player-0"] },
  function* () {
    newUnit("player-1", "wolf", 40.77, 33.05);
    const sheep = newUnit("player-0", "sheep", 45, 31);

    // Create corner fences that force pathing around
    newUnit("player-0", "fence", 41.25, 33.75);
    newUnit("player-0", "fence", 41.25, 34.25);
    newUnit("player-0", "fence", 38.75, 33.75);

    // Track "Over 10 order loops" warnings
    let loopWarningCount = 0;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" && args[0].includes("Over 10 order loops")
      ) {
        loopWarningCount++;
        console.log("Loop detected in test:", ...args);
      }
      originalWarn(...args);
    };

    // Run until sheep is killed - wolf should auto-attack
    yield* yieldFor(() => {
      expect(sheep.health).toBe(0);
    }, { timeout: 20 });

    console.warn = originalWarn;

    expect(loopWarningCount).toBe(0);
  },
);
