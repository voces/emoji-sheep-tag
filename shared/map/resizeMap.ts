import type { LoadedMap } from "../map.ts";
import type { Cliff } from "../../client/graphics/Terrain2D.ts";
import {
  getCliffHeight,
  getPathingMaskFromTerrainMasks,
} from "../pathing/terrainHelpers.ts";

type ResizeDirection = "top" | "bottom" | "left" | "right";

type ResizeParams = {
  direction: ResizeDirection;
  amount: number; // Positive = expand, negative = shrink
};

const interpolateTileRow = (
  tiles: number[][],
  edge: "top" | "bottom",
): number[] => {
  // tiles[0] = top, tiles[length-1] = bottom
  const row = edge === "top" ? tiles[0] : tiles[tiles.length - 1];
  if (!row) return [];
  return [...row];
};

const interpolateTileColumn = (
  tiles: number[][],
  side: "left" | "right",
): number[] => {
  const columnIndex = side === "left" ? 0 : tiles[0].length - 1;
  return tiles.map((row) => row[columnIndex] ?? 0);
};

const interpolateCliffRow = (
  cliffs: Cliff[][],
  edge: "top" | "bottom",
): Cliff[] => {
  // cliffs[0] = top, cliffs[length-1] = bottom
  const row = edge === "top" ? cliffs[0] : cliffs[cliffs.length - 1];
  if (!row) return [];
  return [...row];
};

const interpolateCliffColumn = (
  cliffs: Cliff[][],
  side: "left" | "right",
): Cliff[] => {
  const columnIndex = side === "left" ? 0 : cliffs[0].length - 1;
  return cliffs.map((row) => row[columnIndex] ?? "r");
};

const interpolateWaterRow = (
  water: number[][],
  edge: "top" | "bottom",
): number[] => {
  const row = edge === "top" ? water[0] : water[water.length - 1];
  if (!row) return [];
  return [...row];
};

const interpolateWaterColumn = (
  water: number[][],
  side: "left" | "right",
): number[] => {
  const columnIndex = side === "left" ? 0 : water[0].length - 1;
  return water.map((row) => row[columnIndex] ?? 0);
};

export const resizeMap = (
  map: LoadedMap,
  { direction, amount }: ResizeParams,
): LoadedMap => {
  if (amount === 0) return map;

  const isExpanding = amount > 0;
  const absAmount = Math.abs(amount);

  let newTiles = map.tiles.map((row) => [...row]);
  let newCliffs = map.cliffs.map((row) => [...row]);
  let newWater = map.water.map((row) => [...row]);

  // Update bounds
  // When resizing terrain, bounds should only shift (not resize)
  // to maintain the same absolute world positions
  // Only the separate "Adjust Bounds" controls should change bounds size
  const newBounds = {
    min: {
      x: map.bounds.min.x,
      y: map.bounds.min.y,
    },
    max: {
      x: map.bounds.max.x,
      y: map.bounds.max.y,
    },
  };

  switch (direction) {
    case "top":
      // Note: tiles[0] = top in world space (high Y)
      if (isExpanding) {
        // Expand top: add rows at the beginning (array index 0 = high Y = top)
        const tilesToAdd: number[][] = [];
        const cliffsToAdd: Cliff[][] = [];
        const waterToAdd: number[][] = [];
        for (let i = 0; i < absAmount; i++) {
          tilesToAdd.push(interpolateTileRow(newTiles, "top"));
          cliffsToAdd.push(interpolateCliffRow(newCliffs, "top"));
          waterToAdd.push(interpolateWaterRow(newWater, "top"));
        }
        newTiles = [...tilesToAdd, ...newTiles];
        newCliffs = [...cliffsToAdd, ...newCliffs];
        newWater = [...waterToAdd, ...newWater];
      } else {
        // Shrink top: remove rows from the beginning
        newTiles = newTiles.slice(absAmount);
        newCliffs = newCliffs.slice(absAmount);
        newWater = newWater.slice(absAmount);
      }
      break;

    case "bottom":
      // Note: tiles[tiles.length-1] = bottom in world space (low Y)
      if (isExpanding) {
        // Expand bottom: add rows at the end (array end = low Y = bottom)
        for (let i = 0; i < absAmount; i++) {
          newTiles.push(interpolateTileRow(newTiles, "bottom"));
          newCliffs.push(interpolateCliffRow(newCliffs, "bottom"));
          newWater.push(interpolateWaterRow(newWater, "bottom"));
        }
        newBounds.min.y += absAmount;
        newBounds.max.y += absAmount;
      } else {
        // Shrink bottom: remove rows from the end
        newTiles = newTiles.slice(0, -absAmount);
        newCliffs = newCliffs.slice(0, -absAmount);
        newWater = newWater.slice(0, -absAmount);
        newBounds.min.y -= absAmount;
        newBounds.max.y -= absAmount;
      }
      break;

    case "right":
      if (isExpanding) {
        // Expand right: add columns at the end
        const columnToAdd = interpolateTileColumn(newTiles, "right");
        const cliffColumnToAdd = interpolateCliffColumn(newCliffs, "right");
        const waterColumnToAdd = interpolateWaterColumn(newWater, "right");
        for (let i = 0; i < absAmount; i++) {
          newTiles = newTiles.map((row, idx) => [...row, columnToAdd[idx]]);
          newCliffs = newCliffs.map((
            row,
            idx,
          ) => [...row, cliffColumnToAdd[idx]]);
          newWater = newWater.map((
            row,
            idx,
          ) => [...row, waterColumnToAdd[idx]]);
        }
      } else {
        // Shrink right: remove columns from the end
        newTiles = newTiles.map((row) => row.slice(0, -absAmount));
        newCliffs = newCliffs.map((row) => row.slice(0, -absAmount));
        newWater = newWater.map((row) => row.slice(0, -absAmount));
      }
      break;

    case "left":
      if (isExpanding) {
        // Expand left: add columns at the beginning
        const columnToAdd = interpolateTileColumn(newTiles, "left");
        const cliffColumnToAdd = interpolateCliffColumn(newCliffs, "left");
        const waterColumnToAdd = interpolateWaterColumn(newWater, "left");
        for (let i = 0; i < absAmount; i++) {
          newTiles = newTiles.map((row, idx) => [columnToAdd[idx], ...row]);
          newCliffs = newCliffs.map((
            row,
            idx,
          ) => [cliffColumnToAdd[idx], ...row]);
          newWater = newWater.map((
            row,
            idx,
          ) => [waterColumnToAdd[idx], ...row]);
        }
        newBounds.min.x += absAmount;
        newBounds.max.x += absAmount;
      } else {
        // Shrink left: remove columns from the beginning
        newTiles = newTiles.map((row) => row.slice(absAmount));
        newCliffs = newCliffs.map((row) => row.slice(absAmount));
        newWater = newWater.map((row) => row.slice(absAmount));
        newBounds.min.x -= absAmount;
        newBounds.max.x -= absAmount;
      }
      break;
  }

  const newWidth = newTiles[0]?.length ?? 0;
  const newHeight = newTiles.length;

  newBounds.min.x = Math.max(0.5, Math.min(newBounds.min.x, newWidth - 0.5));
  newBounds.max.x = Math.max(
    newBounds.min.x,
    Math.min(newBounds.max.x, newWidth - 0.5),
  );
  newBounds.min.y = Math.max(0.5, Math.min(newBounds.min.y, newHeight - 0.5));
  newBounds.max.y = Math.max(
    newBounds.min.y,
    Math.min(newBounds.max.y, newHeight - 0.5),
  );

  // The mask is anchored to the bounds region. Bounds may shift during a
  // terrain resize but their span is unchanged, so the mask data carries over
  // unchanged.
  const newMask = map.mask.map((row) => [...row]);

  // Rebuild terrain pathing and layers (these will be recalculated)
  const rawPathing = getPathingMaskFromTerrainMasks(
    newTiles,
    newCliffs,
    newWater,
    newBounds,
    newMask,
  );
  const terrainPathingMap = rawPathing.toReversed();
  const terrainLayers = rawPathing.map((row, y) =>
    row.map((_, x) => Math.floor(getCliffHeight(x, y, newCliffs)))
  ).toReversed();

  return {
    ...map,
    tiles: newTiles,
    cliffs: newCliffs,
    water: newWater,
    mask: newMask,
    width: newWidth,
    height: newHeight,
    bounds: newBounds,
    terrainPathingMap,
    terrainLayers,
  };
};

export const getEntityShiftForResize = (
  { direction, amount }: ResizeParams,
): { x: number; y: number } => {
  // Note: This should match the offsetX/offsetY calculated in resizeMap
  // Entities need to shift to maintain the same position relative to terrain
  const isExpanding = amount > 0;
  const absAmount = Math.abs(amount);

  switch (direction) {
    case "left":
      // Left: adds/removes columns at beginning, shifts content right/left
      return { x: isExpanding ? absAmount : -absAmount, y: 0 };
    case "bottom":
      // Bottom: expanding shifts coordinate system, need counter-shift
      return { x: 0, y: isExpanding ? absAmount : -absAmount };
    case "top":
    case "right":
      // Top/Right: no shift needed
      return { x: 0, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
};
