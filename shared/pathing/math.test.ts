import { assertEquals } from "jsr:@std/assert";
import { distanceBetweenEntities } from "./math.ts";

const sheep = {
  id: "sheep-1",
  radius: 0.25,
  position: { x: 0, y: 0 },
};

Deno.test("distanceBetweenEntities > unit & unit", () => {
  assertEquals(
    distanceBetweenEntities(
      sheep,
      {
        id: "wolf-1",
        radius: 0.5,
        position: { x: 1, y: 1 },
      },
    ),
    Math.SQRT2 - 0.75,
  );
});

Deno.test("distanceBetweenEntities > unit & structure", () => {
  const microHutTilemap = {
    map: [1],
    top: -0.5,
    left: -0.5,
    width: 1,
    height: 1,
  };
  const tinyHutTilemap = {
    map: Array(4).fill(1),
    top: -1,
    left: -1,
    width: 2,
    height: 2,
  };
  const hutTilemap = {
    map: Array(16).fill(1),
    top: -2,
    left: -2,
    width: 4,
    height: 4,
  };

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: microHutTilemap,
      position: { x: 2, y: 0 },
    }),
    1.5,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: microHutTilemap,
      position: { x: -2, y: 0 },
    }),
    1.5,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: 2, y: 0 },
    }),
    1.25,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: -2, y: 0 },
    }),
    1.25,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: 1.5, y: 1.5 },
    }),
    Math.SQRT2 - 0.25,
  );

  assertEquals(
    distanceBetweenEntities({
      id: "wolf",
      radius: 0.5,
      position: { x: 24.893809202550525, y: 24.527661432142406 },
    }, {
      id: "hut-0",
      tilemap: hutTilemap,
      position: { x: 23, y: 24.5 },
    }),
    0.3938092025505249,
  );
});
