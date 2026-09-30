import type { Cell } from "./brush.ts";
import type {
  EditorBrushShape,
  EditorBrushSize,
  EditorTerrainSelection,
} from "@/vars/editor.ts";

/**
 * The cell set a brush preview is showing plus the key of the inputs that
 * produced it. A refresh whose key matches can skip the cell recompute and
 * geometry rebuild.
 */
export type PreviewCache = {
  readonly key: string;
  readonly cells: ReadonlySet<number>;
};

const cellId = (x: number, y: number) => y * 100000 + x;

export const buildPreviewCache = (
  key: string,
  cells: ReadonlyArray<readonly [number, number]>,
): PreviewCache => ({
  key,
  cells: new Set(cells.map(([x, y]) => cellId(x, y))),
});

/**
 * Whether the cached cells still apply for `key`. A fill's cells depend on
 * which region the cursor is in, not just the source value in the key, so it
 * also needs the cursor cell inside the cached set.
 */
export const isPreviewCached = (
  cache: PreviewCache | undefined,
  key: string,
  fill: boolean,
  x: number,
  y: number,
) => !!cache && key === cache.key && (!fill || cache.cells.has(cellId(x, y)));

export const clipCells = (
  cells: ReadonlyArray<readonly [number, number]>,
  selection: EditorTerrainSelection | undefined,
): Cell[] =>
  selection
    ? cells.filter(([x, y]) =>
      x >= selection.minX && x <= selection.maxX && y >= selection.minY &&
      y <= selection.maxY
    ).map(([x, y]) => [x, y])
    : cells.map(([x, y]) => [x, y]);

/**
 * A tile preview draws its cells clipped to the terrain selection, matching
 * what a click paints, but caches the unclipped cells so a fill stays cached
 * while the cursor is inside its region yet outside the selection.
 */
export const buildTilePreview = (
  key: string,
  cells: ReadonlyArray<readonly [number, number]>,
  selection: EditorTerrainSelection | undefined,
) => ({
  cache: buildPreviewCache(key, cells),
  drawn: clipCells(cells, selection),
});

export const selectionKey = (selection: EditorTerrainSelection | undefined) =>
  selection
    ? `${selection.minX},${selection.minY},${selection.maxX},${selection.maxY}`
    : "none";

/**
 * Sized brushes move with the cursor; "all" and a fill (while the cursor
 * stays inside its region) do not.
 */
export const tilePreviewKey = (
  size: EditorBrushSize,
  shape: EditorBrushShape,
  x: number,
  y: number,
  grid: { width: number; height: number },
  toolKey: string,
  fillValue: () => number,
) =>
  size === "all"
    ? `all|${grid.width}|${grid.height}|${toolKey}`
    : size === "fill"
    ? `fill|${toolKey}|${fillValue()}`
    : `brush|${size}|${shape}|${x}|${y}|${toolKey}`;

export const maskPreviewKey = (
  kind: "mask" | "unmask",
  size: EditorBrushSize,
  shape: EditorBrushShape,
  x: number,
  y: number,
  fillValue: () => number,
) =>
  size === "all"
    ? `mask|${kind}|all`
    : size === "fill"
    ? `mask-fill|${kind}|${fillValue()}`
    : `mask|${kind}|${size}|${shape}|${x}|${y}`;
