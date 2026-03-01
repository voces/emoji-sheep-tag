import { describe, it } from "@std/testing/bdd";
import { PathingMap } from "./PathingMap.ts";
import { expect } from "@std/expect";

describe("PathingMap", () => {
  it("should find path around obstacles", () => {
    const solver = new PathingMap({
      pathing: [[0, 1, 0], [0, 0, 0]],
    });
    expect(
      solver.path(
        { id: "0", position: { x: 0.5, y: 0.5 }, radius: 0.5, pathing: 1 },
        { x: 2.5, y: 0.5 },
      ),
    ).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 1.5 },
      { x: 2.5, y: 1.5 },
      { x: 2.5, y: 0.5 },
    ]);
  });

  it("should prevent units from walking off map boundaries", () => {
    // Create a small 3x3 map where all tiles are walkable
    const solver = new PathingMap({
      pathing: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      resolution: 2,
    });

    const unit = {
      id: "unit-0",
      radius: 0.5,
      position: { x: 1.5, y: 1.5 },
      pathing: 1,
    };

    // Unit with radius 0.5 at center (1.5, 1.5) should be pathable
    expect(solver.pathable(unit, 1.5, 1.5)).toBe(true);

    // Unit with radius 0.5 at edge positions should NOT be pathable
    // because part of the unit would extend beyond the map

    // At x=0.4, the unit's left edge would be at -0.1 (outside map)
    expect(solver.pathable(unit, 0.4, 1.5)).toBe(false);

    // At x=0.5, the unit's left edge would be at 0.0 (just at boundary)
    expect(solver.pathable(unit, 0.5, 1.5)).toBe(true);

    // At x=2.5, the unit's right edge would be at 3.0 (just at boundary)
    expect(solver.pathable(unit, 2.5, 1.5)).toBe(true);

    // At x=2.6, the unit's right edge would be at 3.1 (outside map)
    expect(solver.pathable(unit, 2.6, 1.5)).toBe(false);

    // Same for Y axis
    expect(solver.pathable(unit, 1.5, 0.4)).toBe(false);
    expect(solver.pathable(unit, 1.5, 0.5)).toBe(true);
    expect(solver.pathable(unit, 1.5, 2.5)).toBe(true);
    expect(solver.pathable(unit, 1.5, 2.6)).toBe(false);

    // Corner cases - unit at corner but still within bounds
    expect(solver.pathable(unit, 0.5, 0.5)).toBe(true);
    expect(solver.pathable(unit, 2.5, 2.5)).toBe(true);

    // Corner cases - unit slightly outside corner
    expect(solver.pathable(unit, 0.4, 0.4)).toBe(false);
    expect(solver.pathable(unit, 2.6, 2.6)).toBe(false);
  });

  it("should not cut corner on last segment", () => {
    const solver = new PathingMap({
      resolution: 4,
      // Exclusion: [0.75, 2.25]
      pathing: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
    });
    const sheep = {
      id: "sheep-0",
      radius: 0.25,
      position: { x: 1, y: 2.25 },
      pathing: 1,
    };
    solver.addEntity(sheep);
    expect(
      solver.path(sheep, {
        x: 2.3675290273743266,
        y: 2.232444915084466,
      }),
    ).toEqual([
      { x: 1, y: 2.25 },
      { x: 2.25, y: 2.25 },
      { x: 2.3675290273743266, y: 2.232444915084466 },
    ]);
  });

  it("should handle entity updates near map boundaries", () => {
    const solver = new PathingMap({
      pathing: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      resolution: 2,
    });

    const entity = {
      id: "entity-test",
      radius: 0.5,
      position: { x: 1.5, y: 1.5 },
      pathing: 1,
    };

    // Add entity initially
    solver.addEntity(entity);

    // Move entity to edge positions that would cause out-of-bounds access
    // This simulates what happens with translocation hut teleporting units
    entity.position = { x: 2.9, y: 2.9 };
    expect(() => solver.updateEntity(entity)).not.toThrow();

    // Move to negative coordinates
    entity.position = { x: -0.5, y: 1.5 };
    expect(() => solver.updateEntity(entity)).not.toThrow();

    // Move to far out of bounds
    entity.position = { x: 10, y: 10 };
    expect(() => solver.updateEntity(entity)).not.toThrow();
  });

  it("should handle distance to target corner", () => {
    const sheep = {
      id: "sheep-0",
      radius: 0.25,
      position: { x: 1.75, y: 1.75 },
      pathing: 1,
    };
    const wolf = {
      id: "wolf-0",
      radius: 0.5,
      position: { x: 0.5, y: 0.5 },
      pathing: 1,
    };
    const solver = new PathingMap({
      resolution: 4,
      pathing: [[0, 0], [0, 0]],
    });
    solver.addEntity(sheep);
    solver.addEntity(wolf);
    const path = solver.path(wolf, sheep, { distanceFromTarget: 0.09 });
    expect(path.length).toBe(2);
    expect(path[0]).toEqual({ x: 0.5, y: 0.5 });
    // The exact end position can vary slightly due to pathfinding heuristics
    // but should be near the target (within the distance threshold)
    expect(Math.abs(path[1].x - 1.25)).toBeLessThan(0.3);
    expect(Math.abs(path[1].y - 1)).toBeLessThan(0.3);
  });

  describe("start position fixes", () => {
    it("should handle entity at non-pathable start tile", () => {
      // Create a map with a fence blocking x=1
      // 0 0 1 0
      // 0 0 1 0
      const solver = new PathingMap({
        pathing: [
          [0, 0, 1, 0],
          [0, 0, 1, 0],
        ],
        resolution: 4,
      });

      // Entity at position that rounds to a blocked tile
      const entity = {
        id: "entity-0",
        position: { x: 0.5, y: 0.5 },
        radius: 0.25,
        pathing: 1,
      };

      // This should find nearest pathable tile and generate a valid path
      const path = solver.path(entity, { x: 1.5, y: 0.5 });

      // Should have a valid path with multiple waypoints
      expect(path.length).toBeGreaterThan(1);

      // First waypoint should be linearly pathable from start
      expect(solver.linearPathable(entity, path[0], path[1])).toBe(true);
    });

    it("should return empty path when nearest pathable tile is too far", () => {
      // Create a map where entity is surrounded by walls with pathable corners
      // 0 1 1 1 0
      // 1 1 1 1 1
      // 1 1 1 1 1  <- entity at center, on blocked tile
      // 1 1 1 1 1
      // 0 1 1 1 0
      const solver = new PathingMap({
        pathing: [
          [0, 1, 1, 1, 0],
          [1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1],
          [0, 1, 1, 1, 0],
        ],
        resolution: 4,
      });

      // Entity at center, which rounds to a non-pathable tile
      // Nearest pathable tile is at corner (0.5, 0.5) which is ~2.83 units away
      const entity = {
        id: "entity-0",
        position: { x: 2.5, y: 2.5 },
        radius: 0.25,
        pathing: 1,
      };

      // Should return empty path because nearest pathable tile is too far (> 0.5 units)
      const path = solver.path(entity, { x: 0.5, y: 0.5 });
      expect(path).toEqual([]);
    });

    it("should allow small position adjustments within 0.5 units", () => {
      // Create a narrow corridor scenario
      // 0 1 0
      // 0 0 0
      const solver = new PathingMap({
        pathing: [
          [0, 1, 0],
          [0, 0, 0],
        ],
        resolution: 4,
      });

      // Entity slightly off-center from pathable position
      const entity = {
        id: "entity-0",
        position: { x: 0.4, y: 0.5 },
        radius: 0.25,
        pathing: 1,
      };

      // Should adjust to nearby pathable tile and find path
      const path = solver.path(entity, { x: 2.5, y: 0.5 });
      expect(path.length).toBeGreaterThan(0);
    });

    it("should generate valid first waypoint even with obstacles nearby", () => {
      // Recreate the stuck wolf scenario
      // Wolf at (1.87, 1.34), fence wall at x=1.25
      const solver = new PathingMap({
        pathing: [
          [0, 0, 1, 0, 0],
          [0, 0, 1, 0, 0],
          [0, 0, 1, 0, 0],
          [0, 0, 1, 0, 0],
          [0, 0, 1, 0, 0],
        ],
        resolution: 4,
      });

      const entity = {
        id: "wolf-0",
        position: { x: 1.87, y: 1.34 },
        radius: 0.25,
        pathing: 1,
      };

      const target = { x: 2.5, y: 0.88 };
      const path = solver.path(entity, target);

      // Should generate a valid path with multiple waypoints
      expect(path.length).toBeGreaterThan(1);

      const firstWaypoint = path[1];

      // Should be able to reach first waypoint (this is the key fix)
      expect(solver.linearPathable(entity, path[0], firstWaypoint)).toBe(true);

      // All segments in path should be linearly pathable
      for (let i = 0; i < path.length - 1; i++) {
        expect(solver.linearPathable(entity, path[i], path[i + 1])).toBe(true);
      }
    });
  });

  describe("out-of-bounds target clamping", () => {
    it("should clamp point target to map bounds", () => {
      const solver = new PathingMap({
        pathing: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        resolution: 2,
      });

      const entity = {
        id: "entity-0",
        position: { x: 1.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
      };

      // Target well outside the map bounds (map is 3x3, so 0-3 world coords)
      expect(() => solver.path(entity, { x: 5, y: 1.5 })).not.toThrow();
      expect(() => solver.path(entity, { x: 1.5, y: -2 })).not.toThrow();
      expect(() => solver.path(entity, { x: -1, y: -1 })).not.toThrow();
      expect(() => solver.path(entity, { x: 10, y: 10 })).not.toThrow();
    });

    it("should clamp entity target to map bounds accounting for radius", () => {
      const solver = new PathingMap({
        pathing: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        resolution: 2,
      });

      const entity = {
        id: "entity-0",
        position: { x: 1.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
      };

      const targetEntity = {
        id: "target-0",
        position: { x: 5, y: 5 },
        radius: 0.5,
      };

      // Target entity outside bounds should not throw
      expect(() => solver.path(entity, targetEntity)).not.toThrow();
    });

    it("should path towards clamped position when target is out of bounds", () => {
      const solver = new PathingMap({
        pathing: [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0],
        ],
        resolution: 2,
      });

      const entity = {
        id: "entity-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
      };

      // Target far to the right of the map - should path towards right edge
      const path = solver.path(entity, { x: 10, y: 1.5 });
      expect(path.length).toBeGreaterThan(0);
      // Last waypoint should be near the right edge of the map (3.0), clamped for radius (0.5)
      const lastPoint = path[path.length - 1];
      expect(lastPoint.x).toBeGreaterThan(1.5);
    });
  });

  describe("pointToTilemap", () => {
    it("1x1 aligned", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.625, 0.625, 0.125),
      ).toEqual({ left: 0, top: 0, height: 1, width: 1, map: [1] });
    });

    it("2x2 aligned", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.5, 0.5, 0.25),
      ).toEqual({
        left: -1,
        top: -1,
        height: 2,
        width: 2,
        map: [1, 1, 1, 1],
      });
    });

    it("2x2 perfectly unaligned", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.625, 0.625, 0.25),
      ).toEqual({
        left: -1,
        top: -1,
        height: 3,
        width: 3,
        map: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      });
    });

    it("2x2 perfectly unaligned2", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.375, 0.375, 0.25),
      ).toEqual({
        left: -1,
        top: -1,
        height: 3,
        width: 3,
        map: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      });
    });

    it("2x2 vertically aligned", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.625, 0.5, 0.17),
      ).toEqual({
        left: -1,
        top: -1,
        height: 2,
        width: 3,
        map: [1, 1, 1, 1, 1, 1],
      });
    });

    it("2x2 horizontally aligned", () => {
      expect(
        new PathingMap({
          pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
          resolution: 4,
          tileResolution: 2,
        }).pointToTilemap(0.5, 0.625, 0.17),
      ).toEqual({
        left: -1,
        top: -1,
        height: 3,
        width: 2,
        map: [1, 1, 1, 1, 1, 1],
      });
    });
  });

  describe("pathWithDestruction", () => {
    it("should find path through destroyable entity in blocked corridor", () => {
      // Create a corridor (terrain walls top and bottom) blocked by a structure
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1], // terrain wall
          [0, 0, 0, 0, 0], // corridor
          [1, 1, 1, 1, 1], // terrain wall
        ],
        resolution: 4,
      });

      // Block the corridor with a structure
      const blocker = {
        id: "structure-0",
        position: { x: 2.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
        blocksPathing: 1,
      };
      solver.addEntity(blocker);

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      // With destruction, should find path through and include the blocker
      const result = solver.pathWithDestruction(
        entity,
        { x: 4.5, y: 1.5 },
        (e) => e.id === "structure-0" ? 5 : undefined,
      );

      expect(result).toBeDefined();
      expect(result!.path.length).toBeGreaterThan(0);
      expect(result!.toDestroy).toContain(blocker);
    });

    it("should not path through indestructible entities in blocked corridor", () => {
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      const blocker = {
        id: "indestructible-0",
        position: { x: 2.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
        blocksPathing: 1,
      };
      solver.addEntity(blocker);

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      const result = solver.pathWithDestruction(
        entity,
        { x: 4.5, y: 1.5 },
        () => undefined,
      );

      expect(result).toBeUndefined();
    });

    it("should prefer going around over expensive destruction", () => {
      // Open map with single blocker
      const solver = new PathingMap({
        pathing: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
        ],
        resolution: 4,
      });

      const blocker = {
        id: "expensive-0",
        position: { x: 2.5, y: 2.5 },
        radius: 0.25,
        pathing: 1,
        blocksPathing: 1,
      };
      solver.addEntity(blocker);

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 2.5 },
        radius: 0.25,
        pathing: 1,
      };

      const result = solver.pathWithDestruction(
        entity,
        { x: 4.5, y: 2.5 },
        (e) => e.id === "expensive-0" ? 50 : undefined,
      );

      expect(result).toBeDefined();
      // Should go around rather than destroy expensive structure
      expect(result!.toDestroy).toHaveLength(0);
    });

    it("should prefer destruction when cheaper than going around", () => {
      // Create terrain that forces a long detour
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      // Block the middle with a cheap-to-destroy structure
      const blocker = {
        id: "cheap-0",
        position: { x: 3.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
        blocksPathing: 1,
      };
      solver.addEntity(blocker);

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      const result = solver.pathWithDestruction(
        entity,
        { x: 6.5, y: 1.5 },
        (e) => e.id === "cheap-0" ? 1 : undefined,
      );

      expect(result).toBeDefined();
      expect(result!.toDestroy.length).toBeGreaterThan(0);
    });

    it("should respect maxCost and bail out", () => {
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      // Multiple blockers requiring destruction
      for (let x = 1; x < 4; x++) {
        const blocker = {
          id: `structure-${x}`,
          position: { x: x + 0.5, y: 1.5 },
          radius: 0.25,
          pathing: 1,
          blocksPathing: 1,
        };
        solver.addEntity(blocker);
      }

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      // Each costs 10, would need 30+ total
      const result = solver.pathWithDestruction(
        entity,
        { x: 4.5, y: 1.5 },
        () => 10,
        15, // lower than needed
      );

      expect(result).toBeUndefined();
    });

    it("should not count same entity twice when it spans multiple tiles", () => {
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      // Large structure blocking the corridor
      const largeStructure = {
        id: "large-structure",
        position: { x: 3, y: 1.5 },
        radius: 0.5, // spans multiple tiles
        pathing: 1,
        blocksPathing: 1,
      };
      solver.addEntity(largeStructure);

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      const result = solver.pathWithDestruction(
        entity,
        { x: 5.5, y: 1.5 },
        (e) => e.id === "large-structure" ? 5 : undefined,
      );

      expect(result).toBeDefined();
      expect(result!.toDestroy).toHaveLength(1);
      expect(result!.toDestroy[0]).toBe(largeStructure);
    });

    it("should return partial path with structures when hitting maxCost", () => {
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      // Place structures that completely block the corridor
      // Use larger radius so they fully block
      for (let x = 2; x < 7; x++) {
        solver.addEntity({
          id: `structure-${x}`,
          position: { x: x + 0.5, y: 1.5 },
          radius: 0.5,
          pathing: 1,
          blocksPathing: 1,
        });
      }

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      // Each structure costs 5, total would be 25, but maxCost is 12
      const result = solver.pathWithDestruction(
        entity,
        { x: 8.5, y: 1.5 },
        () => 5,
        12, // Only allow 12 cost - enough for ~2 structures
      );

      // Should return partial path with some structures
      expect(result).toBeDefined();
      expect(result!.toDestroy.length).toBeGreaterThan(0);
      expect(result!.toDestroy.length).toBeLessThan(5); // Not all structures
    });

    it("should return undefined when no structures to destroy and path blocked", () => {
      const solver = new PathingMap({
        pathing: [
          [1, 1, 1, 1, 1],
          [0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1],
        ],
        resolution: 4,
      });

      // Add indestructible blocker
      solver.addEntity({
        id: "indestructible",
        position: { x: 2.5, y: 1.5 },
        radius: 0.5,
        pathing: 1,
        blocksPathing: 1,
      });

      const entity = {
        id: "wolf-0",
        position: { x: 0.5, y: 1.5 },
        radius: 0.25,
        pathing: 1,
      };

      // Can't destroy anything, should return undefined
      const result = solver.pathWithDestruction(
        entity,
        { x: 4.5, y: 1.5 },
        () => undefined,
      );

      expect(result).toBeUndefined();
    });
  });
});
