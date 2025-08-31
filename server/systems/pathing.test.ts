import { afterEach } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { newUnit, orderMove } from "../api/unit.ts";
import { prefabs } from "@/shared/data.ts";
import { initEntities } from "@/shared/map.ts";

afterEach(cleanupTest);

it("should not oscillate when wolf cannot move due to pathability issues", function* ({ ecs }) {
  // Initialize map
  for (const prefab in initEntities) {
    for (const partial of initEntities[prefab as keyof typeof initEntities]) {
      ecs.addEntity({ prefab, ...prefabs[prefab], ...partial });
    }
  }

  // Create wolf at the specific coordinates from the bug report
  const wolf = newUnit("wolf-player", "wolf", 15.129065853722569, 10.661490916452644);
  yield;
  
  const target = { x: 13.349277257901191, y: 9.818286642149658 };
  orderMove(wolf, target);
  
  // Track path changes to detect oscillation
  const pathHistory: string[] = [];
  
  for (let tick = 0; tick < 8; tick++) {
    const currentPath = wolf.order?.type === "walk" ? JSON.stringify(wolf.order.path) : "null";
    pathHistory.push(currentPath);
    yield;
  }
  
  // Check for oscillation pattern (alternating between two states)
  const uniquePaths = [...new Set(pathHistory)];
  let hasOscillation = false;
  
  if (uniquePaths.length === 2) {
    // Check if alternating between two paths (classic oscillation)
    for (let i = 2; i < pathHistory.length; i++) {
      if (pathHistory[i] === pathHistory[i-2] && pathHistory[i] !== pathHistory[i-1]) {
        hasOscillation = true;
        break;
      }
    }
  }
  
  // Should not oscillate - either stable (1 path) or progressing (multiple paths)
  expect(hasOscillation).toBe(false);
  expect(uniquePaths.length).not.toBe(2); // 2 unique paths usually indicates oscillation
  expect(wolf.position).toBeDefined();
});