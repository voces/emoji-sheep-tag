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
    expect(
      solver.path(wolf, sheep, { distanceFromTarget: 0.09 }),
    ).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 1.25, y: 1 },
    ]);
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
