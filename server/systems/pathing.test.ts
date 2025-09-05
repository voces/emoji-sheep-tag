import { afterEach } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { newUnit, orderMove } from "../api/unit.ts";
import { prefabs } from "@/shared/data.ts";
import { initEntities } from "@/shared/map.ts";

afterEach(cleanupTest);

it(
  "should not oscillate when wolf cannot move due to pathability issues",
  function* ({ ecs }) {
    // Initialize map
    for (const prefab in initEntities) {
      for (const partial of initEntities[prefab as keyof typeof initEntities]) {
        ecs.addEntity({ prefab, ...prefabs[prefab], ...partial });
      }
    }

    // Create wolf at the specific coordinates from the bug report
    const wolf = newUnit(
      "wolf-player",
      "wolf",
      15.129065853722569,
      10.661490916452644,
    );
    yield;

    const target = { x: 13.349277257901191, y: 9.818286642149658 };
    orderMove(wolf, target);

    // Track path changes to detect oscillation
    const pathHistory: string[] = [];

    for (let tick = 0; tick < 8; tick++) {
      const currentPath = wolf.order?.type === "walk"
        ? JSON.stringify(wolf.order.path)
        : "null";
      pathHistory.push(currentPath);
      yield;
    }

    // When no path exists, the order gets cleared
    // This means we should see the order become null after attempting to path
    // to an unreachable location
    const hasNullOrder = pathHistory.includes("null");

    // The order should be cleared (null) since the wolf can't reach the target
    expect(hasNullOrder).toBe(true);

    // After the order is cleared, the wolf should stop trying to move
    // Check that the last few entries are consistently null (no oscillation)
    const lastEntries = pathHistory.slice(-3);
    const allNull = lastEntries.every((p) => p === "null");
    expect(allNull).toBe(true);

    expect(wolf.position).toBeDefined();
  },
);
