import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import {
  canSeeTarget,
  getMaxEntityHeight,
  getMinEntityHeight,
  TERRAIN_SCALE,
} from "./visibility.ts";
import { buildLoadedMap } from "./map.ts";
import revoMap from "./maps/revo.json" with { type: "json" };

// Helper to create a terrain grid with specified heights
// terrainLayers is at 2x resolution (TERRAIN_SCALE=2)
const createTerrainGrid = (
  width: number,
  height: number,
  defaultHeight = 0,
): number[][] => {
  const grid: number[][] = [];
  for (let y = 0; y < height * TERRAIN_SCALE; y++) {
    grid[y] = [];
    for (let x = 0; x < width * TERRAIN_SCALE; x++) {
      grid[y][x] = defaultHeight;
    }
  }
  return grid;
};

// Helper to set a cliff region (in world coords)
const setCliffRegion = (
  grid: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
) => {
  const sx = Math.floor(x * TERRAIN_SCALE);
  const sy = Math.floor(y * TERRAIN_SCALE);
  const ex = Math.floor((x + w) * TERRAIN_SCALE);
  const ey = Math.floor((y + h) * TERRAIN_SCALE);
  for (let ty = sy; ty < ey; ty++) {
    for (let tx = sx; tx < ex; tx++) {
      if (grid[ty]) grid[ty][tx] = height;
    }
  }
};

// No blockers for these tests
const noBlockers = () => [];

describe("getMinEntityHeight", () => {
  it("returns terrain height at position for non-tilemap entity", () => {
    const terrain = createTerrainGrid(10, 10, 0);
    setCliffRegion(terrain, 5, 5, 2, 2, 1);

    // Position on cliff
    expect(getMinEntityHeight({ x: 5.5, y: 5.5 }, undefined, terrain)).toBe(1);
    // Position on ground
    expect(getMinEntityHeight({ x: 2, y: 2 }, undefined, terrain)).toBe(0);
  });

  it("returns minimum height across tilemap tiles", () => {
    const terrain = createTerrainGrid(10, 10, 0);
    // Create a ramp-like cliff: left half at height 0, right half at height 1
    setCliffRegion(terrain, 5, 0, 5, 10, 1);

    // 4x4 tilemap in pathing coords (1 world unit), centered at (5, 5)
    // Spans boundary between height 0 and 1
    // Pathing coords: 4 per world unit, terrain coords: 2 per world unit
    const tilemap = {
      top: -2,
      left: -2,
      height: 4,
      width: 4,
      map: Array(16).fill(1), // all tiles occupied
    };

    // Entity at x=5, at the boundary
    // Tilemap spans 1 world unit centered at (5,5), so from x=4.5 to x=5.5
    // West half at height 0, east half at height 1
    const minHeight = getMinEntityHeight({ x: 5, y: 5 }, tilemap, terrain);
    expect(minHeight).toBe(0); // Minimum is 0 since part is on lower ground
  });

  it("returns 0 for empty tilemap", () => {
    const terrain = createTerrainGrid(10, 10, 1);
    const tilemap = {
      top: -2,
      left: -2,
      height: 4,
      width: 4,
      map: Array(16).fill(0), // no tiles occupied
    };
    expect(getMinEntityHeight({ x: 5, y: 5 }, tilemap, terrain)).toBe(0);
  });
});

describe("getMaxEntityHeight", () => {
  it("returns terrain height at position for non-tilemap entity", () => {
    const terrain = createTerrainGrid(10, 10, 0);
    setCliffRegion(terrain, 5, 5, 2, 2, 1);

    expect(getMaxEntityHeight({ x: 5.5, y: 5.5 }, undefined, terrain)).toBe(1);
    expect(getMaxEntityHeight({ x: 2, y: 2 }, undefined, terrain)).toBe(0);
  });

  it("returns maximum height across tilemap tiles", () => {
    const terrain = createTerrainGrid(10, 10, 0);
    setCliffRegion(terrain, 5, 0, 5, 10, 1);

    // 4x4 tilemap in pathing coords (1 world unit), centered at (5, 5)
    const tilemap = {
      top: -2,
      left: -2,
      height: 4,
      width: 4,
      map: Array(16).fill(1),
    };

    const maxHeight = getMaxEntityHeight({ x: 5, y: 5 }, tilemap, terrain);
    expect(maxHeight).toBe(1); // Maximum is 1 since part is on higher ground
  });
});

describe("canSeeTarget with tilemaps on cliffs", () => {
  describe("vertical (north-south) cliff with ramp", () => {
    // Cliff runs vertically (north-south)
    // West side is low (height 0), east side is high (height 1)
    // Ramp at y=5 allows transition
    const createVerticalCliffWithRamp = () => {
      const terrain = createTerrainGrid(20, 20, 0);
      // East half is cliff (height 1), except for ramp region
      for (let y = 0; y < 20 * TERRAIN_SCALE; y++) {
        for (let x = 10 * TERRAIN_SCALE; x < 20 * TERRAIN_SCALE; x++) {
          terrain[y][x] = 1;
        }
      }
      // Ramp at y=5: gradual transition at x=10
      // Make the ramp 2 tiles wide in world coords
      for (let y = 4 * TERRAIN_SCALE; y < 6 * TERRAIN_SCALE; y++) {
        for (let x = 9 * TERRAIN_SCALE; x < 11 * TERRAIN_SCALE; x++) {
          // Transition zone - height 0 on west, height 1 on east
          terrain[y][x] = x < 10 * TERRAIN_SCALE ? 0 : 1;
        }
      }
      return terrain;
    };

    it("viewer on low ground can see structure on ramp boundary (north of viewer)", () => {
      const terrain = createVerticalCliffWithRamp();

      // Viewer on low ground, west of cliff
      const viewer = { position: { x: 5, y: 3 }, sightRadius: 20 };

      // Structure at ramp boundary - spans low and high ground
      // 4x4 structure at x=9, y=4 (overlaps ramp transition)
      const target = {
        position: { x: 9.5, y: 4.5 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it("viewer on low ground can see structure on ramp boundary (south of viewer)", () => {
      const terrain = createVerticalCliffWithRamp();

      // Viewer on low ground, south of structure
      const viewer = { position: { x: 5, y: 7 }, sightRadius: 20 };

      // Same structure at ramp boundary
      const target = {
        position: { x: 9.5, y: 4.5 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it("viewer north or south of structure should have same visibility", () => {
      const terrain = createVerticalCliffWithRamp();

      // Structure at ramp boundary
      const target = {
        position: { x: 9.5, y: 5 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      // Viewer north of structure
      const viewerNorth = { position: { x: 5, y: 2 }, sightRadius: 20 };
      // Viewer south of structure
      const viewerSouth = { position: { x: 5, y: 8 }, sightRadius: 20 };

      const canSeeFromNorth = canSeeTarget(
        viewerNorth,
        target,
        terrain,
        noBlockers,
      );
      const canSeeFromSouth = canSeeTarget(
        viewerSouth,
        target,
        terrain,
        noBlockers,
      );

      expect(canSeeFromNorth).toBe(canSeeFromSouth);
    });
  });

  describe("structure spanning multiple terrain heights", () => {
    it("structure half on cliff half on ground is visible from low ground", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      // Cliff on eastern half
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

      // 4x4 structure at boundary, half on each level
      const target = {
        position: { x: 10, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      // Should be visible because part of structure is at ground level
      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it("structure entirely on cliff is NOT visible from low ground", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

      // Structure entirely on cliff
      const target = {
        position: { x: 15, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(false);
    });

    it("viewer structure on cliff edge can see target on ground", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      // Viewer structure at cliff edge - spans both heights
      const viewer = {
        position: { x: 10, y: 10 },
        sightRadius: 20,
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      // Target on low ground
      const target = { position: { x: 5, y: 10 } };

      // Viewer can see from highest point (cliff level)
      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });
  });

  describe("diagonal approaches to cliff structures", () => {
    it("can see structure from diagonal approach (southwest)", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 3, y: 12 }, sightRadius: 20 };

      // Structure at cliff edge
      const target = {
        position: { x: 10, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it("can see structure from diagonal approach (northwest)", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 3, y: 8 }, sightRadius: 20 };

      const target = {
        position: { x: 10, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      // Debug: verify target has tiles on low ground
      const minHeight = getMinEntityHeight(
        target.position,
        target.tilemap,
        terrain,
      );
      expect(minHeight).toBe(0); // Should have low ground tiles

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });
  });

  describe("L-shaped and irregular tilemaps", () => {
    it("L-shaped structure with one tile on low ground is visible", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

      // L-shaped structure where only bottom-left corner is on low ground
      // Position at x=10 means it straddles the boundary
      const target = {
        position: { x: 10, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: [
            1,
            1,
            1,
            1, // top row - mostly on cliff
            1,
            1,
            1,
            1,
            1,
            1,
            0,
            0, // L-shape
            1,
            1,
            0,
            0,
          ],
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it("structure with only high-ground tiles is not visible from below", () => {
      const terrain = createTerrainGrid(20, 20, 0);
      setCliffRegion(terrain, 10, 0, 10, 20, 1);

      const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

      // Structure positioned so all occupied tiles are on cliff
      // 4x4 tilemap in pathing coords (1 world unit) centered at x=12
      const target = {
        position: { x: 12, y: 10 },
        tilemap: {
          top: -2,
          left: -2,
          height: 4,
          width: 4,
          map: Array(16).fill(1),
        },
      };

      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(false);
    });
  });
});

describe("raycast blocking with tilemaps", () => {
  it("cliff between viewer and target blocks LOS even if target min height is low", () => {
    const terrain = createTerrainGrid(20, 20, 0);
    // Create a ridge in the middle
    setCliffRegion(terrain, 9, 0, 2, 20, 2);
    // Target area back to ground level
    setCliffRegion(terrain, 15, 8, 4, 4, 0);

    const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

    // Target on far side of ridge, at ground level
    const target = {
      position: { x: 17, y: 10 },
      tilemap: {
        top: -2,
        left: -2,
        height: 4,
        width: 4,
        map: Array(16).fill(1),
      },
    };

    // Should be blocked by the ridge between them
    expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(false);
  });
});

describe("raycast destination issue", () => {
  // The core issue: raycast goes to entity CENTER, but we want visibility
  // if we can see ANY tile of the entity at the min height level

  it("raycast to center fails when center is on high ground but edges are on low", () => {
    const terrain = createTerrainGrid(20, 20, 0);
    // Cliff on eastern half - sharp boundary at x=10
    setCliffRegion(terrain, 10, 0, 10, 20, 1);

    // Viewer on low ground
    const viewer = { position: { x: 5, y: 8 }, sightRadius: 20 };

    // 4x4 structure centered at x=10 (boundary)
    // Tiles span x=8-12 in world coords, which is x=16-24 in terrain coords
    // At terrain scale=2: x<20 is height 0, x>=20 is height 1
    const target = {
      position: { x: 10, y: 10 },
      tilemap: {
        top: -2,
        left: -2,
        height: 4,
        width: 4,
        map: Array(16).fill(1),
      },
    };

    // Check min height - should be 0 (has tiles on low ground)
    const minHeight = getMinEntityHeight(
      target.position,
      target.tilemap,
      terrain,
    );
    expect(minHeight).toBe(0);

    // The ray from (5,8) to (10,10) will pass through terrain cells.
    // At some point it crosses the cliff boundary.
    // The current code raycast to CENTER (10,10), which is ON the cliff.
    // The raycast will hit cliff cells before reaching target center.
    // This SHOULD still return true because target has low-ground tiles.
    expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
  });

  it("direct horizontal approach works because ray endpoint is on low ground", () => {
    const terrain = createTerrainGrid(20, 20, 0);
    setCliffRegion(terrain, 10, 0, 10, 20, 1);

    // Viewer directly west, same y as target
    const viewer = { position: { x: 5, y: 10 }, sightRadius: 20 };

    const target = {
      position: { x: 10, y: 10 },
      tilemap: {
        top: -2,
        left: -2,
        height: 4,
        width: 4,
        map: Array(16).fill(1),
      },
    };

    // This passes because the ray stays on low ground until hitting the structure
    expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
  });

  it("diagonal approach from below fails incorrectly", () => {
    const terrain = createTerrainGrid(20, 20, 0);
    setCliffRegion(terrain, 10, 0, 10, 20, 1);

    // Viewer from southwest
    const viewer = { position: { x: 5, y: 12 }, sightRadius: 20 };

    const target = {
      position: { x: 10, y: 10 },
      tilemap: {
        top: -2,
        left: -2,
        height: 4,
        width: 4,
        map: Array(16).fill(1),
      },
    };

    // Should pass - structure has tiles on low ground
    expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
  });

  it("diagonal approach from above fails incorrectly", () => {
    const terrain = createTerrainGrid(20, 20, 0);
    setCliffRegion(terrain, 10, 0, 10, 20, 1);

    // Viewer from northwest
    const viewer = { position: { x: 5, y: 8 }, sightRadius: 20 };

    const target = {
      position: { x: 10, y: 10 },
      tilemap: {
        top: -2,
        left: -2,
        height: 4,
        width: 4,
        map: Array(16).fill(1),
      },
    };

    // Should pass - structure has tiles on low ground
    // But currently FAILS because raycast to center hits cliff
    expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
  });
});

describe("revo terrain cliff visibility", () => {
  // Load actual revo terrain
  const loadedMap = buildLoadedMap("revo", revoMap);
  const terrain = loadedMap.terrainLayers;

  // Tilemap definitions matching shared/data.ts
  const tilemap2x2 = {
    top: -1,
    left: -1,
    width: 2,
    height: 2,
    map: Array(4).fill(1),
  };
  const tilemap4x4 = {
    top: -2,
    left: -2,
    width: 4,
    height: 4,
    map: Array(16).fill(1),
  };
  const tilemap6x6 = {
    top: -3,
    left: -3,
    width: 6,
    height: 6,
    map: Array(36).fill(1),
  };
  const tilemap8x8 = {
    top: -4,
    left: -4,
    width: 8,
    height: 8,
    map: Array(64).fill(1),
  };

  // Test entities placed on cliff boundary
  // Left variants are positioned so part of the structure is on low ground (visible)
  // Right variants are positioned so the structure is entirely on high ground (not visible)
  const testCases = [
    {
      name: "shack",
      tilemap: tilemap2x2,
      leftPos: { x: 37.75, y: 59.75 },
      rightPos: { x: 38.25, y: 59.75 },
    },
    {
      name: "hut",
      tilemap: tilemap4x4,
      leftPos: { x: 38, y: 61.5 },
      rightPos: { x: 38.5, y: 60.5 },
    },
    {
      name: "cottage",
      tilemap: tilemap6x6,
      leftPos: { x: 38.25, y: 64.25 },
      rightPos: { x: 38.75, y: 62.75 },
    },
    {
      name: "house",
      tilemap: tilemap8x8,
      leftPos: { x: 38.5, y: 68 },
      rightPos: { x: 39, y: 66 },
    },
  ];

  // Viewer positioned to the left (west) of the structures, on low ground
  const viewer = { position: { x: 36, y: 64 }, sightRadius: 20 };

  for (const { name, tilemap, leftPos, rightPos } of testCases) {
    it(`${name} on cliff edge (left variant) should be visible from low ground`, () => {
      const target = { position: leftPos, tilemap };
      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(true);
    });

    it(`${name} on cliff (right variant) should NOT be visible from low ground`, () => {
      const target = { position: rightPos, tilemap };
      expect(canSeeTarget(viewer, target, terrain, noBlockers)).toBe(false);
    });
  }
});
