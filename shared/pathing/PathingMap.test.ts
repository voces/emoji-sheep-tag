import { describe, it } from "jsr:@std/testing/bdd";
import { PathingMap } from "./PathingMap.ts";
import { assertEquals } from "jsr:@std/assert";
import { expect } from "jsr:@std/expect";

Deno.test("ok", () => {
  const solver = new PathingMap({
    pathing: [[0, 1, 0], [0, 0, 0]],
  });
  assertEquals(
    solver.path(
      { id: "0", position: { x: 0.5, y: 0.5 }, radius: 0.5, pathing: 1 },
      { x: 2.5, y: 0.5 },
    ),
    [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 1.5 },
      { x: 2.5, y: 1.5 },
      { x: 2.5, y: 0.5 },
    ],
  );
});

Deno.test("does not cut corner on last segment", () => {
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
  // const check = Array.from(
  //   { length: path.length - 1 },
  //   (_, i) =>
  //     solver.withoutEntity(
  //       sheep,
  //       () => solver.linearPathable(sheep, path[i], path[i + 1]),
  //     ),
  // );
  assertEquals(
    solver.path(sheep, {
      x: 2.3675290273743266,
      y: 2.232444915084466,
    }),
    [
      { x: 1, y: 2.25 },
      { x: 2.25, y: 2.25 },
      { x: 2.3675290273743266, y: 2.232444915084466 },
    ],
  );
});

Deno.test("distance to target corner", () => {
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
  const solver = new PathingMap({ resolution: 4, pathing: [[0, 0], [0, 0]] });
  solver.addEntity(sheep);
  solver.addEntity(wolf);
  assertEquals(
    solver.path(wolf, sheep, { distanceFromTarget: 0.09 }),
    [
      { x: 0.5, y: 0.5 },
      { x: 1.25, y: 1 },
    ],
  );
});

describe("pointToTilemap", () => {
  it("1x1 aligned", () => {
    expect(
      new PathingMap({
        pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
        resolution: 4,
      }).pointToTilemap(0.625, 0.625, 0.125),
    ).toEqual({ left: 0, top: 0, height: 1, width: 1, map: [1] });
  });

  it("2x2 aligned", () => {
    expect(
      new PathingMap({
        pathing: Array.from({ length: 5 }, () => Array(5).fill(0)),
        resolution: 4,
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
