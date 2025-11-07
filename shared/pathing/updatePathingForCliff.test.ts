import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { PathingMap } from "./PathingMap.ts";
import { updatePathingForCliff } from "./updatePathingForCliff.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("updatePathingForCliff", () => {
  it("updates pathing when cliff height changes", {}, function* () {
    // Create a simple 10x10 tile map with uniform terrain (all tile 0, height 2)
    const tiles: number[][] = Array(10).fill(0).map(() => Array(10).fill(0));
    const cliffs: (number | "r")[][] = Array(10).fill(0).map(() =>
      Array(10).fill(2)
    );

    // Create a pathing array (doubled to 20x20 at tileResolution=2)
    const initialPathing: number[][] = Array(20).fill(0).map(() =>
      Array(20).fill(8)
    ); // 8 = walkable

    // Create initial layers (all height 2)
    const initialLayers: number[][] = Array(20).fill(0).map(() =>
      Array(20).fill(2)
    );

    // Create PathingMap
    const pm = new PathingMap({
      pathing: initialPathing,
      resolution: 4,
      tileResolution: 2,
      layers: initialLayers,
    });
    yield;

    // Get initial pathing at grid position (20, 20) which corresponds to tile (5, 5)
    // @ts-ignore - getTile is private
    const tileBefore = pm.getTile(20, 20);
    expect(tileBefore?.originalPathing).toBe(8);

    // Verify initial layer height
    expect(pm.layers![10][10]).toBe(2);

    // Change cliff at tile (5, 5) from height 2 to height 3
    cliffs[5][5] = 3;

    // Update pathing
    updatePathingForCliff(pm, tiles, cliffs, 5, 5);

    // Verify that pathing was updated in the affected area
    // Grid tiles at the cliff edge should be blocked (11 = 8 | 3)
    let foundUpdatedPathing = false;
    for (let gy = 20; gy < 24; gy++) {
      for (let gx = 20; gx < 24; gx++) {
        // @ts-ignore - getTile is private
        const tile = pm.getTile(gx, gy);
        if (tile && tile.originalPathing !== 8) {
          foundUpdatedPathing = true;
          expect(tile.originalPathing).toBe(11); // 8 | 3 = 11
        }
      }
    }
    expect(foundUpdatedPathing).toBe(true);

    // Verify layers were updated
    // Tile (5,5) -> pathing indices (10,10) to (11,11)
    // The center should now have height 3
    expect(pm.layers![10][10]).toBe(3);
    expect(pm.layers![10][11]).toBe(3);
    expect(pm.layers![11][10]).toBe(3);
    expect(pm.layers![11][11]).toBe(3);
  });

  it("updates a 5x5 area around the changed cliff", {}, function* () {
    // Create a simple map
    const tiles: number[][] = Array(20).fill(0).map(() => Array(20).fill(0));
    const cliffs: (number | "r")[][] = Array(20).fill(0).map(() =>
      Array(20).fill(0)
    );

    const initialPathing: number[][] = Array(40).fill(0).map(() =>
      Array(40).fill(8)
    );

    const pm = new PathingMap({
      pathing: initialPathing,
      resolution: 4,
      tileResolution: 2,
    });
    yield;

    // Set cliff at (10, 10) to height 2, leaving neighbors at 0
    cliffs[10][10] = 2;

    // Update pathing
    updatePathingForCliff(pm, tiles, cliffs, 10, 10);

    // Check that tiles in a reasonable area were updated
    // The 5x5 tile area (8-12, 8-12) times 4 grid cells per tile = grid area (32-51, 32-51)
    // @ts-ignore - getTile is private
    const centerTile = pm.getTile(40, 40);
    expect(centerTile).toBeDefined();

    // Verify at least some pathing changed (cliff edges should be blocked)
    let foundBlocked = false;
    for (let gy = 38; gy < 44; gy++) {
      for (let gx = 38; gx < 44; gx++) {
        // @ts-ignore - getTile is private
        const tile = pm.getTile(gx, gy);
        if (tile && tile.originalPathing > 8) {
          foundBlocked = true;
          break;
        }
      }
    }
    expect(foundBlocked).toBe(true);
  });
});
