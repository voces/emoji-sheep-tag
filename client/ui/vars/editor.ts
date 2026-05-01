import { makeVar } from "@/hooks/useVar.tsx";

export const editorVar = makeVar<boolean>(false);
export const editorMapModifiedVar = makeVar<boolean>(false);
/** Live tags for the currently-edited map, derived from tile counts. */
export const editorMapTagsVar = makeVar<readonly string[]>([]);
export const editorCurrentMapVar = makeVar<
  { id: string; name: string } | undefined
>(undefined);
export const editorHideUIVar = makeVar<boolean>(false);

/** Current water level (in cliff units) used when painting water. */
export const editorWaterLevelVar = makeVar<number>(1.25);

export type EditorWaterView = "hide" | "normal" | "level";
/** How water is visualized in the editor. "level" shows masked cells even where the ground is above water. */
export const editorWaterViewVar = makeVar<EditorWaterView>("normal");

/** Routes tile-blueprint clicks: "tile" = paint tile or route via vertexColor sentinels (cliffs), "paintWater" = set water mask, "paintMask" = toggle the manual black-mask vertex grid. */
export type EditorTileMode = "tile" | "paintWater" | "paintMask";
export const editorTileModeVar = makeVar<EditorTileMode>("tile");

/**
 * Brush size for tile, water, and cliff edits. 1 paints a single cell, 2-5
 * expand the brush radius, "fill" flood-fills cells matching the source value
 * (same tile, same water level, or same starting cliff height), and "all"
 * applies to every cell on the map without respecting borders.
 */
export type EditorBrushSize = 1 | 2 | 3 | 4 | 5 | "fill" | "all";
export const editorBrushSizeVar = makeVar<EditorBrushSize>(1);

/** Brush shape used for sizes 2-5. "fill" and "all" ignore this. */
export type EditorBrushShape = "circle" | "square";
export const editorBrushShapeVar = makeVar<EditorBrushShape>("square");

/**
 * Identifies the editor action currently bound to the next click. Drives the
 * "pressed" highlight on terrain/doodad command buttons so users can see which
 * tool is armed. Cleared when the blueprint is cancelled.
 */
export type EditorActiveAction =
  | { kind: "tile"; color: number }
  | { kind: "raise" | "lower" | "ramp" | "plateau" | "water" }
  | { kind: "mask" | "unmask" }
  | { kind: "select" | "paste" }
  | { kind: "doodad"; prefab: string };

export const editorActiveActionVar = makeVar<EditorActiveAction | undefined>(
  undefined,
);

/**
 * Inclusive-bounded rectangular selection in world tile coords. While set,
 * brush / fill / all operations clip their cells to this rectangle. Cleared
 * with Escape or by selecting an empty area.
 */
export type EditorTerrainSelection = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
export const editorTerrainSelectionVar = makeVar<
  EditorTerrainSelection | undefined
>(undefined);

/**
 * In-memory snapshot of terrain (tiles + cliffs + water) for a copied
 * selection. Pasted by entering "paste" mode and clicking to commit.
 */
export type EditorTerrainClipboard = {
  width: number;
  height: number;
  /** Indexed [y][x] from the bottom-left of the captured rectangle. */
  tiles: number[][];
  cliffs: (number | "r")[][];
  water: number[][];
};
export const editorTerrainClipboardVar = makeVar<
  EditorTerrainClipboard | undefined
>(undefined);
