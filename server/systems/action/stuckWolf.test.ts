import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { newUnit } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";
import { yieldFor } from "../../testing/yieldFor.ts";

afterEach(cleanupTest);

it(
  "wolf should kill sheep even with fence wall blocking direct path",
  { wolves: ["player-1"], sheep: ["player-0"] },
  function* () {
    // Recreate the scenario from latest dump.json where wolf got stuck
    // Wolf at (41.87, 39.34), sheep at (44.50, 34.88)
    // Fence wall at x=41.25 from y=34.25 to y=38.75 blocking direct path
    newUnit("player-1", "wolf", 41.87, 39.34);
    const sheep = newUnit("player-0", "sheep", 44.50, 34.88);

    // Create a fence wall blocking direct path (owned by sheep player so wolf targets sheep not fence)
    for (let y = 34.25; y <= 38.75; y += 0.5) {
      newUnit("player-0", "fence", 41.25, y);
    }

    // Track "Over 10 order loops" warnings
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

    // Run until sheep is killed - wolf should auto-attack and path around fence
    yield* yieldFor(() => {
      expect(sheep.health).toBe(0);
    }, { timeout: 30 });

    console.warn = originalWarn;

    // Should not have any loop warnings
    expect(loopWarningCount).toBe(0);
  },
);
