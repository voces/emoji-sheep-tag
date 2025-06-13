import { assertEquals } from "jsr:@std/assert";
import { distanceBetweenEntities, tweenAbsAngles } from "./math.ts";

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
    Math.sqrt(0.25 ** 2 * 2),
  );

  assertEquals(
    distanceBetweenEntities(
      sheep,
      {
        id: "wolf-1",
        radius: 0.5,
        position: { x: 1, y: 0 },
      },
    ),
    0.25,
  );

  assertEquals(
    distanceBetweenEntities(
      { id: "sheep-1", radius: 0.25, position: { x: 1, y: 1 } },
      { id: "wolf-1", radius: 0.5, position: { x: 1, y: 1 + 1 } },
    ),
    0.25,
  );

  assertEquals(
    distanceBetweenEntities(
      { id: "sheep-1", radius: 0.25, position: { x: 1, y: 1 } },
      { id: "wolf-1", radius: 0.5, position: { x: 1 + 1, y: 1 } },
    ),
    0.25,
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
    Math.sqrt(1.625 ** 2 + 0.125 ** 2),
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: microHutTilemap,
      position: { x: -2, y: 0 },
    }),
    Math.sqrt(1.625 ** 2 + 0.125 ** 2),
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: 2, y: 0 },
    }),
    1.5,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: -2, y: 0 },
    }),
    1.5,
  );

  assertEquals(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: tinyHutTilemap,
      position: { x: 1.5, y: 1.5 },
    }),
    Math.SQRT2,
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
    0.75,
  );
});

Deno.test("tweenAbsAngles", () => {
  assertEquals(tweenAbsAngles(0, Math.PI / 2, Math.PI / 4), Math.PI / 4);
  assertEquals(tweenAbsAngles(0, -Math.PI / 2, Math.PI / 4), Math.PI * 7 / 4);
  assertEquals(tweenAbsAngles(-Math.PI / 4, Math.PI / 4, Math.PI / 4), 0);
  assertEquals(tweenAbsAngles(Math.PI / 4, -Math.PI / 4, Math.PI / 4), 0);
  assertEquals(
    tweenAbsAngles(Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI / 4),
    Math.PI,
  );
  assertEquals(
    tweenAbsAngles(Math.PI * 5 / 4, Math.PI * 3 / 4, Math.PI / 4),
    Math.PI,
  );
});
