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
