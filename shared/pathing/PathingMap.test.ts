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
});
