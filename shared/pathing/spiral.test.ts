import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { PathingMap } from "./PathingMap.ts";
import { DIRECTION, PATHING_TYPES } from "./constants.ts";
import { PathingEntity } from "./types.ts";

const build = (blocked: (x: number, y: number) => boolean) => {
  const pathing: number[][] = [];
  for (let y = 0; y < 24; y++) {
    const row: number[] = [];
    for (let x = 0; x < 24; x++) {
      row.push(blocked(x, y) ? PATHING_TYPES.WALKABLE : 0);
    }
    pathing.push(row);
  }
  return new PathingMap({ resolution: 1, pathing });
};

const unit = (x: number, y: number): PathingEntity => ({
  id: "u",
  position: { x, y },
  radius: 0.25,
  pathing: PATHING_TYPES.WALKABLE,
});

describe("nearestSpiralPathing", () => {
  // A malformed spiral revisits cells and skips others, so it can miss the
  // nearest opening entirely. Every start direction must find a lone gap.
  for (
    const [label, direction] of [
      ["down", DIRECTION.DOWN],
      ["left", DIRECTION.LEFT],
      ["up", DIRECTION.UP],
      ["right", DIRECTION.RIGHT],
    ] as const
  ) {
    it(`finds an opening two rings out starting ${label}`, () => {
      for (const [gapX, gapY] of [[10, 12], [8, 10], [10, 8], [12, 10]]) {
        // Everything within two rings of (10, 10) blocked but one cell.
        const map = build((x, y) =>
          Math.abs(x - 10) <= 2 && Math.abs(y - 10) <= 2 &&
          !(x === gapX && y === gapY)
        );

        const found = map.nearestSpiralPathing(
          10.5,
          10.5,
          unit(10.5, 10.5),
          undefined,
          direction,
        );

        expect({ x: Math.floor(found.x), y: Math.floor(found.y) }).toEqual({
          x: gapX,
          y: gapY,
        });
      }
    });
  }
});
