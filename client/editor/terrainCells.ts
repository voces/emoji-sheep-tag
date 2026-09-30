import { terrain } from "../graphics/three.ts";
import { getMap, getMaskShapeForBounds } from "@/shared/map.ts";
import {
  type EditorBrushShape,
  type EditorBrushSize,
  type EditorTileMode,
} from "@/vars/editor.ts";
import {
  type Cell,
  getAllCells,
  getBrushCells,
  getFloodFillCells,
} from "./brush.ts";
import { isCliffTool, type TerrainToolKind } from "./terrainTools.ts";

export const getTileGridSize = () => {
  const grid = terrain.masks.groundTile;
  return { width: grid[0]?.length ?? 0, height: grid.length };
};

/**
 * Whether a tool's fill follows cliff height rather than tiles. Water fills
 * walk the basin defined by surrounding cliffs, not the existing water mask.
 */
export const fillsByCliff = (
  mode: EditorTileMode,
  kind: TerrainToolKind | undefined,
) => mode === "paintWater" || isCliffTool(kind);

/** The value a tile-space fill at (x, y) matches its neighbours on. */
export const getTileFillValue = (
  byCliff: boolean,
  x: number,
  y: number,
): number =>
  byCliff ? terrain.getCliff(x, y) : terrain.masks.groundTile[y]?.[x] ?? -1;

/** Cells a brush, fill or all anchored at tile cell (x, y) covers. */
export const getTileCells = (
  size: EditorBrushSize,
  shape: EditorBrushShape,
  x: number,
  y: number,
  byCliff: boolean,
): Cell[] => {
  const { width, height } = getTileGridSize();
  if (size === "all") return getAllCells(width, height);
  if (size === "fill") {
    return getFloodFillCells(
      x,
      y,
      width,
      height,
      byCliff
        ? (cx, cy) => terrain.getCliff(cx, cy)
        : (cx, cy) => terrain.masks.groundTile[cy][cx],
    );
  }
  return getBrushCells(x, y, size, shape, width, height);
};

/**
 * Mask cells live on cliff vertices anchored to the map bounds, not on tile
 * centres: a world position maps to its nearest vertex, then to mask-grid
 * indices.
 */
export const getMaskAnchor = (worldX: number, worldY: number) => {
  const shape = getMaskShapeForBounds(getMap().bounds);
  const vx = Math.round(worldX);
  const vy = Math.round(worldY);
  return {
    shape,
    vx,
    vy,
    x: vx - shape.firstVertexX,
    y: shape.topVertexY - vy,
  };
};

export type MaskAnchor = ReturnType<typeof getMaskAnchor>;

export const isInMaskGrid = ({ shape, x, y }: MaskAnchor) =>
  x >= 0 && x < shape.width && y >= 0 && y < shape.height;

/**
 * Mask-grid cells a brush, fill or all at the anchor covers. Cells outside
 * the boundary are dropped; a fill needs its anchor inside it.
 */
export const getMaskCells = (
  size: EditorBrushSize,
  shape: EditorBrushShape,
  anchor: MaskAnchor,
): Cell[] => {
  const { width, height } = anchor.shape;
  if (size === "all") return getAllCells(width, height);
  if (size === "fill") {
    const { mask } = getMap();
    return getFloodFillCells(
      anchor.x,
      anchor.y,
      width,
      height,
      (x, y) => mask[y]?.[x] ?? 0,
    );
  }
  return getBrushCells(anchor.x, anchor.y, size, shape, width, height);
};
