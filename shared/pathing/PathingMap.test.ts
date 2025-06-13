// import { Grid } from "./grid.ts";
import { PathingMap } from "./PathingMap.ts";
import { assertEquals } from "jsr:@std/assert";

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
