import { afterEach } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Entity } from "@/shared/types.ts";
import { newUnit, orderBuild } from "../../api/unit.ts";
import { cleanupTest, it } from "../../testing/setup.ts";

afterEach(cleanupTest);

const buildPath = (unit: Entity) =>
  unit.order?.type === "build" ? unit.order.path : undefined;

it(
  "aims at the build point from close range",
  { sheep: ["player-0"] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 41.5, 30);

    yield;

    orderBuild(sheep, "hut", 40.5, 30);

    yield;

    expect(buildPath(sheep)?.at(-1)).toEqual({ x: 40.5, y: 30 });
  },
);

it(
  "aims at the build point from long range",
  { sheep: ["player-0"] },
  function* () {
    const sheep = newUnit("player-0", "sheep", 45.5, 30);

    yield;

    orderBuild(sheep, "hut", 40.5, 30);

    yield;

    expect(buildPath(sheep)?.at(-1)).toEqual({ x: 40.5, y: 30 });
  },
);

it(
  "displaces a unit identically regardless of its sub-tile position",
  { sheep: ["player-0"] },
  function* ({ ecs }) {
    newUnit("player-0", "house", 40, 30);

    yield;

    const placements: string[] = [];

    // Offsets within a single tile, chosen to span every branch the spiral used
    // to take when it derived its start direction from the sub-tile position.
    const subTileOffsets = [[0, 0], [0.04, 0], [0, 0.04], [0.12, 0.04]];

    for (const [xOffset, yOffset] of subTileOffsets) {
      const sheep = newUnit(
        "player-0",
        "sheep",
        39.1 + xOffset,
        30.1 + yOffset,
      );

      yield;

      placements.push(`${sheep.position!.x},${sheep.position!.y}`);
      ecs.removeEntity(sheep);

      yield;
    }

    expect(new Set(placements).size).toBe(1);
  },
);
