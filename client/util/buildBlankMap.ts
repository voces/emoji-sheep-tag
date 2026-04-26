import { type PackedMap } from "@/shared/map.ts";
import { tileDefs } from "@/shared/data.ts";
import { packMap2D, packMap2DAuto } from "@/shared/util/2dPacking.ts";
import { packEntities } from "@/shared/util/entityPacking.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";

const GRASS = 0;
const PEN = 1;
const DEFAULT_CLIFF_HEIGHT = 2;
const DEFAULT_WATER_LEVEL = 1.25;

const BLANK_WIDTH = 32;
const BLANK_HEIGHT = 32;
const BLANK_BOUNDS_SPAN = 17;
const PEN_SIZE = 4;

export const buildBlankPackedMap = (name: string): PackedMap => {
  const width = BLANK_WIDTH;
  const height = BLANK_HEIGHT;

  const tiles: number[][] = Array.from(
    { length: height },
    () => Array.from({ length: width }, () => GRASS),
  );

  const penStartX = Math.floor((width - PEN_SIZE) / 2);
  const penStartY = Math.floor((height - PEN_SIZE) / 2);
  for (let y = penStartY; y < penStartY + PEN_SIZE; y++) {
    for (let x = penStartX; x < penStartX + PEN_SIZE; x++) {
      tiles[y][x] = PEN;
    }
  }

  const cliffsPacked: number[][] = Array.from(
    { length: height },
    () => Array.from({ length: width }, () => DEFAULT_CLIFF_HEIGHT + 1),
  );

  const waterPacked: number[][] = Array.from(
    { length: height },
    () =>
      Array.from(
        { length: width },
        () => Math.round(DEFAULT_WATER_LEVEL * WATER_LEVEL_SCALE),
      ),
  );

  const inset = (width - BLANK_BOUNDS_SPAN) / 2;
  const insetY = (height - BLANK_BOUNDS_SPAN) / 2;

  return {
    name,
    center: { x: width / 2, y: height / 2 },
    bounds: {
      min: { x: inset, y: insetY },
      max: { x: width - inset, y: height - insetY },
    },
    terrain: packMap2D(tiles, tileDefs.length),
    cliffs: packMap2D(cliffsPacked, DEFAULT_CLIFF_HEIGHT + 1),
    water: packMap2DAuto(waterPacked),
    entities: packEntities([]),
  };
};
