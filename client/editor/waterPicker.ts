import { terrain } from "../graphics/three.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import { editorPickWaterLevelVar, editorVar } from "@/vars/editor.ts";

/**
 * Reads the water level (in cliff units) at the cell containing the given
 * world coordinates. Returns 0 outside the map. Uses the same cell mapping as
 * the tile brush (`Math.round(world - 0.5)`).
 */
export const sampleWaterLevelAtWorld = (
  worldX: number,
  worldY: number,
): number => {
  const cellX = Math.round(worldX - 0.5);
  const cellY = Math.round(worldY - 0.5);
  return terrain.getWater(cellX, cellY) / WATER_LEVEL_SCALE;
};

if (!("Deno" in globalThis)) {
  editorVar.subscribe((active) => {
    if (!active && editorPickWaterLevelVar()) editorPickWaterLevelVar(false);
  });
}
