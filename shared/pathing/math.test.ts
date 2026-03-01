import { expect } from "@std/expect";
import {
  distanceBetweenEntities,
  entityPoints,
  tweenAbsAngles,
} from "./math.ts";
import { describe, it } from "@std/testing/bdd";

const sheep = {
  id: "sheep-1",
  radius: 0.25,
  position: { x: 0, y: 0 },
};

it("distanceBetweenEntities > unit & unit", () => {
  expect(
    distanceBetweenEntities(
      sheep,
      {
        id: "wolf-1",
        radius: 0.5,
        position: { x: 1, y: 1 },
      },
    ),
  ).toEqual(Math.sqrt(0.25 ** 2 * 2));

  expect(
    distanceBetweenEntities(
      sheep,
      {
        id: "wolf-1",
        radius: 0.5,
        position: { x: 1, y: 0 },
      },
    ),
  ).toEqual(0.25);

  expect(
    distanceBetweenEntities(
      { id: "sheep-1", radius: 0.25, position: { x: 1, y: 1 } },
      { id: "wolf-1", radius: 0.5, position: { x: 1, y: 1 + 1 } },
    ),
  ).toEqual(0.25);

  expect(
    distanceBetweenEntities(
      { id: "sheep-1", radius: 0.25, position: { x: 1, y: 1 } },
      { id: "wolf-1", radius: 0.5, position: { x: 1 + 1, y: 1 } },
    ),
  ).toEqual(0.25);
});

it("distanceBetweenEntities > unit & structure", () => {
  const microHutTilemap = {
    map: [1],
    top: -0.5,
    left: -0.5,
    width: 1,
    height: 1,
  };
  const shackTilemap = {
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

  expect(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: microHutTilemap,
      position: { x: 2, y: 0 },
    }),
  ).toEqual(Math.sqrt(1.625 ** 2 + 0.125 ** 2));

  expect(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: microHutTilemap,
      position: { x: -2, y: 0 },
    }),
  ).toEqual(Math.sqrt(1.625 ** 2 + 0.125 ** 2));

  expect(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: shackTilemap,
      position: { x: 2, y: 0 },
    }),
  ).toEqual(1.5);

  expect(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: shackTilemap,
      position: { x: -2, y: 0 },
    }),
  ).toEqual(1.5);

  expect(
    distanceBetweenEntities(sheep, {
      id: "hut-0",
      tilemap: shackTilemap,
      position: { x: 1.5, y: 1.5 },
    }),
  ).toEqual(Math.SQRT2);

  expect(
    distanceBetweenEntities({
      id: "wolf",
      radius: 0.5,
      position: { x: 24.893809202550525, y: 24.527661432142406 },
    }, {
      id: "hut-0",
      tilemap: hutTilemap,
      position: { x: 23, y: 24.5 },
    }),
  ).toEqual(0.75);
});

describe("distanceBetweenEntities > non-grid-aligned units", () => {
  it("returns consistent results for fractional positions", () => {
    const wolf = {
      id: "wolf-1",
      radius: 0.5,
      position: { x: 5.37, y: 8.91 },
    };
    const target = {
      id: "sheep-1",
      radius: 0.25,
      position: { x: 6.12, y: 8.91 },
    };
    const d1 = distanceBetweenEntities(wolf, target);
    const d2 = distanceBetweenEntities(wolf, target);
    expect(d1).toEqual(d2);
  });

  it("returns 0 for overlapping entities at same position", () => {
    const a = { id: "a", radius: 0.5, position: { x: 10, y: 10 } };
    const b = { id: "b", radius: 0.5, position: { x: 10, y: 10 } };
    expect(distanceBetweenEntities(a, b)).toEqual(0);
  });

  it("is symmetric", () => {
    const a = {
      id: "a",
      radius: 0.5,
      position: { x: 3.33, y: 7.77 },
    };
    const b = {
      id: "b",
      radius: 0.25,
      position: { x: 5.55, y: 9.11 },
    };
    expect(distanceBetweenEntities(a, b)).toEqual(
      distanceBetweenEntities(b, a),
    );
  });

  it("returns Infinity when position is missing", () => {
    expect(distanceBetweenEntities({ id: "a" }, { id: "b" })).toEqual(
      Infinity,
    );
    expect(
      distanceBetweenEntities({ id: "a", position: { x: 0, y: 0 } }, {
        id: "b",
      }),
    ).toEqual(Infinity);
  });

  it("max bailout does not prevent touching entities from returning 0", () => {
    const wolf = { id: "wolf", radius: 0.5, position: { x: 10, y: 10 } };
    const target = { id: "sheep", radius: 0.25, position: { x: 10, y: 10 } };
    expect(distanceBetweenEntities(wolf, target, 0.09)).toEqual(0);
  });
});

describe("entityPoints", () => {
  it("returns position for entity without radius or tilemap", () => {
    const e = { id: "e", position: { x: 5, y: 3 } };
    expect(entityPoints(e)).toEqual([5, 3]);
  });

  it("returns empty for entity without position", () => {
    expect(entityPoints({ id: "e" })).toEqual([]);
  });

  it("returns consistent points for grid-aligned entity", () => {
    const e = { id: "e", radius: 0.25, position: { x: 5, y: 5 } };
    const p1 = entityPoints(e);
    const p2 = entityPoints(e);
    expect(p1).toEqual(p2);
    expect(p1.length).toBeGreaterThan(0);
    expect(p1.length % 2).toEqual(0);
  });

  it("returns points for non-grid-aligned entity", () => {
    const e = { id: "e", radius: 0.5, position: { x: 5.13, y: 7.67 } };
    const pts = entityPoints(e);
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.length % 2).toEqual(0);
  });

  it("updates when entity position changes", () => {
    const e = { id: "e", radius: 0.25, position: { x: 5, y: 5 } };
    const p1 = entityPoints(e);
    e.position = { x: 6, y: 6 };
    const p2 = entityPoints(e);
    expect(p1).not.toEqual(p2);
  });
});

it("tweenAbsAngles", () => {
  expect(tweenAbsAngles(0, Math.PI / 2, Math.PI / 4)).toEqual(Math.PI / 4);
  expect(tweenAbsAngles(0, -Math.PI / 2, Math.PI / 4)).toEqual(Math.PI * 7 / 4);
  expect(tweenAbsAngles(-Math.PI / 4, Math.PI / 4, Math.PI / 4)).toEqual(0);
  expect(tweenAbsAngles(Math.PI / 4, -Math.PI / 4, Math.PI / 4)).toEqual(0);
  expect(tweenAbsAngles(Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI / 4))
    .toEqual(Math.PI);
  expect(tweenAbsAngles(Math.PI * 5 / 4, Math.PI * 3 / 4, Math.PI / 4))
    .toEqual(Math.PI);
});
