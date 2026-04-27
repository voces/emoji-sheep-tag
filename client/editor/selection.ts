import { mouse } from "../mouse.ts";
import { scene, terrain } from "../graphics/three.ts";
import { SelectionOverlay } from "../graphics/SelectionOverlay.ts";
import {
  editorActiveActionVar,
  editorTerrainClipboardVar,
  type EditorTerrainSelection,
  editorTerrainSelectionVar,
  editorVar,
} from "@/vars/editor.ts";
import { tileDefs } from "@/shared/data.ts";
import { getBlueprint } from "../controls/blueprintHandlers.ts";
import {
  bulkSetCliffsCommand,
  bulkSetWatersCommand,
  doExecute,
  type EditorCommand,
  fillTilesCommand,
} from "./commands.ts";

let overlay: SelectionOverlay | undefined;
let editorScopedSubscriptions: Array<() => void> = [];
let mouseAttached = false;

const tileColorTable = (): number[] => tileDefs.map((t) => t.color);

const getMaskDimensions = () => {
  const grid = terrain.masks.groundTile;
  return { width: grid[0]?.length ?? 0, height: grid.length };
};

const clampToMap = (
  rect: EditorTerrainSelection,
): EditorTerrainSelection | undefined => {
  const { width, height } = getMaskDimensions();
  if (width === 0 || height === 0) return undefined;
  const minX = Math.max(0, Math.min(rect.minX, rect.maxX));
  const maxX = Math.min(width - 1, Math.max(rect.minX, rect.maxX));
  const minY = Math.max(0, Math.min(rect.minY, rect.maxY));
  const maxY = Math.min(height - 1, Math.max(rect.minY, rect.maxY));
  if (minX > maxX || minY > maxY) return undefined;
  return { minX, minY, maxX, maxY };
};

/** Intersect a cell list with the active selection (if any). */
export const clipCellsToSelection = (
  cells: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> => {
  const sel = editorTerrainSelectionVar();
  if (!sel) return cells.map(([x, y]) => [x, y]);
  const out: Array<[number, number]> = [];
  for (const [x, y] of cells) {
    if (x >= sel.minX && x <= sel.maxX && y >= sel.minY && y <= sel.maxY) {
      out.push([x, y]);
    }
  }
  return out;
};

/** Snapshot terrain inside the selection rect into the clipboard. */
export const copyTerrainSelection = () => {
  const sel = editorTerrainSelectionVar();
  if (!sel) return;
  const w = sel.maxX - sel.minX + 1;
  const h = sel.maxY - sel.minY + 1;
  const tiles: number[][] = [];
  const cliffs: (number | "r")[][] = [];
  const water: number[][] = [];
  // terrain.masks.* is indexed [y][x] where y=0 is the bottom of the world
  // (already reversed during load). Walk the rect in the same orientation so
  // the clipboard preserves world layout.
  for (let y = 0; y < h; y++) {
    const tileRow: number[] = [];
    const cliffRow: (number | "r")[] = [];
    const waterRow: number[] = [];
    for (let x = 0; x < w; x++) {
      const wx = sel.minX + x;
      const wy = sel.minY + y;
      tileRow.push(terrain.masks.groundTile[wy]?.[wx] ?? 0);
      cliffRow.push(terrain.masks.cliff[wy]?.[wx] ?? 0);
      waterRow.push(terrain.masks.water[wy]?.[wx] ?? 0);
    }
    tiles.push(tileRow);
    cliffs.push(cliffRow);
    water.push(waterRow);
  }
  editorTerrainClipboardVar({ width: w, height: h, tiles, cliffs, water });
};

/** Clear the selection rectangle. Called by Esc and "Clear" actions. */
export const clearTerrainSelection = () => {
  editorTerrainSelectionVar(undefined);
};

/** Convenience: where the cursor is in world tile coords (rounded to a cell). */
export const cursorWorldCell = (): [number, number] | undefined => {
  const blueprint = getBlueprint();
  if (!blueprint?.position) return undefined;
  return [
    Math.round(blueprint.position.x - 0.5),
    Math.round(blueprint.position.y - 0.5),
  ];
};

/** Set the selection from a drag (start, current). Empty drag clears. */
export const setSelectionFromDrag = (
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
) => {
  const rect = clampToMap({
    minX: Math.min(startX, currentX),
    minY: Math.min(startY, currentY),
    maxX: Math.max(startX, currentX),
    maxY: Math.max(startY, currentY),
  });
  editorTerrainSelectionVar(rect);
};

const stampOriginAt = (
  cursorX: number,
  cursorY: number,
  width: number,
  height: number,
): [number, number] => [
  cursorX - Math.floor(width / 2),
  cursorY - Math.floor(height / 2),
];

/**
 * Apply the clipboard at the current cursor and return the sub-commands that
 * were executed. The caller is responsible for recording them in the undo
 * stack — typically by accumulating the per-stamp sub-commands across a drag
 * and merging them on mouseup so the whole drag is one undo.
 */
export const commitPaste = (): EditorCommand[] => {
  const placement = getStampPlacement();
  const clipboard = editorTerrainClipboardVar();
  if (!placement || !clipboard) return [];
  const { originX, originY, width, height } = placement;
  const { width: mapW, height: mapH } = getMaskDimensions();
  if (mapW === 0 || mapH === 0) return [];

  const tileGroups = new Map<number, [number, number][]>();
  const cliffUpdates: Array<
    { x: number; y: number; oldCliff: number | "r"; newCliff: number | "r" }
  > = [];
  const waterUpdates: Array<
    { x: number; y: number; oldWater: number; newWater: number }
  > = [];

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const wx = originX + dx;
      const wy = originY + dy;
      if (wx < 0 || wx >= mapW || wy < 0 || wy >= mapH) continue;

      const newTile = clipboard.tiles[dy]?.[dx] ?? 0;
      const oldTile = terrain.masks.groundTile[wy]?.[wx] ?? 0;
      if (newTile !== oldTile) {
        const list = tileGroups.get(newTile);
        if (list) list.push([wx, wy]);
        else tileGroups.set(newTile, [[wx, wy]]);
      }

      const newCliff = clipboard.cliffs[dy]?.[dx] ?? 0;
      const oldCliff = terrain.masks.cliff[wy]?.[wx];
      if (oldCliff !== undefined && newCliff !== oldCliff) {
        cliffUpdates.push({ x: wx, y: wy, oldCliff, newCliff });
      }

      const newWater = clipboard.water[dy]?.[dx] ?? 0;
      const oldWater = terrain.masks.water[wy]?.[wx] ?? 0;
      if (newWater !== oldWater) {
        waterUpdates.push({ x: wx, y: wy, oldWater, newWater });
      }
    }
  }

  const subs: EditorCommand[] = [];
  for (const [newTile, cells] of tileGroups) {
    // The command stores a single oldTile per group; collapse cells that share
    // the same oldTile so undo restores them correctly.
    const byOldTile = new Map<number, [number, number][]>();
    for (const [x, y] of cells) {
      const oldTile = terrain.masks.groundTile[y][x];
      const list = byOldTile.get(oldTile);
      if (list) list.push([x, y]);
      else byOldTile.set(oldTile, [[x, y]]);
    }
    for (const [oldTile, group] of byOldTile) {
      subs.push(fillTilesCommand(
        group,
        oldTile,
        newTile,
        tileDefs[oldTile]?.pathing ?? 0,
        tileDefs[newTile]?.pathing ?? 0,
      ));
    }
  }
  if (cliffUpdates.length) subs.push(bulkSetCliffsCommand(cliffUpdates));
  if (waterUpdates.length) subs.push(bulkSetWatersCommand(waterUpdates));

  for (const cmd of subs) doExecute(cmd);
  return subs;
};

/**
 * Returns the {originX, originY, width, height} of the paste stamp anchored
 * at the cursor cell, used by both the preview and the commit.
 */
export const getStampPlacement = (): {
  originX: number;
  originY: number;
  width: number;
  height: number;
} | undefined => {
  const clipboard = editorTerrainClipboardVar();
  if (!clipboard) return undefined;
  const cell = cursorWorldCell();
  if (!cell) return undefined;
  const [originX, originY] = stampOriginAt(
    cell[0],
    cell[1],
    clipboard.width,
    clipboard.height,
  );
  return { originX, originY, width: clipboard.width, height: clipboard.height };
};

const refresh = () => {
  if (!overlay) return;
  if (!editorVar()) {
    overlay.setSelection(undefined);
    overlay.setStamp(undefined, 0, 0, []);
    return;
  }
  overlay.setSelection(editorTerrainSelectionVar());
  if (editorActiveActionVar()?.kind === "paste") {
    const placement = getStampPlacement();
    if (placement) {
      overlay.setStamp(
        editorTerrainClipboardVar(),
        placement.originX,
        placement.originY,
        tileColorTable(),
      );
    } else overlay.setStamp(undefined, 0, 0, []);
  } else overlay.setStamp(undefined, 0, 0, []);
};

const attach = () => {
  if (mouseAttached) return;
  mouseAttached = true;
  mouse.addEventListener("mouseMove", refresh);
  editorScopedSubscriptions = [
    editorTerrainSelectionVar.subscribe(refresh),
    editorActiveActionVar.subscribe(refresh),
    editorTerrainClipboardVar.subscribe(refresh),
  ];
};

const detach = () => {
  if (!mouseAttached) return;
  mouseAttached = false;
  mouse.removeEventListener("mouseMove", refresh);
  for (const unsubscribe of editorScopedSubscriptions) unsubscribe();
  editorScopedSubscriptions = [];
};

const init = () => {
  if (overlay || "Deno" in globalThis) return;
  overlay = new SelectionOverlay();
  scene.add(overlay);
  if (editorVar()) attach();
  editorVar.subscribe((active) => {
    if (active) attach();
    else {
      detach();
      editorTerrainSelectionVar(undefined);
      overlay?.setSelection(undefined);
      overlay?.setStamp(undefined, 0, 0, []);
    }
  });
};

init();
