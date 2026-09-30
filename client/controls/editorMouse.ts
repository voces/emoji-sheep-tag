import { MouseButtonEvent, MouseMoveEvent } from "../mouse.ts";
import { Entity } from "../ecs.ts";
import { terrain } from "../graphics/three.ts";
import { selection } from "../systems/selection.ts";
import { selectEntity } from "../api/selection.ts";
import { getBlueprint, normalizeBuildPosition } from "./blueprintHandlers.ts";
import { getCliffs, getMask } from "@/shared/map.ts";
import {
  editorBrushShapeVar,
  editorBrushSizeVar,
  editorPickWaterLevelVar,
  editorTerrainSelectionVar,
  editorTileModeVar,
  editorVar,
  editorWaterLevelVar,
} from "@/vars/editor.ts";
import { type Cell } from "../editor/brush.ts";
import {
  fillsByCliff,
  getMaskAnchor,
  getMaskCells,
  getTileCells,
  getTileGridSize,
} from "../editor/terrainCells.ts";
import {
  getLevelTarget,
  getRegionTarget,
  getTerrainTool,
  isCliffTool,
  type TerrainTool,
} from "../editor/terrainTools.ts";
import {
  clearTerrainSelection,
  clipCellsToSelection,
  commitPaste,
  setSelectionFromDrag,
} from "../editor/selection.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import { pickDoodad } from "../ui/views/Game/Editor/DoodadsPanel.tsx";
import { tileDefs } from "@/shared/data.ts";
import {
  type BulkSetCliffsCommand,
  bulkSetCliffsCommand,
  type BulkSetMasksCommand,
  bulkSetMasksCommand,
  type BulkSetWatersCommand,
  bulkSetWatersCommand,
  createEntityCommand,
  doExecute,
  type EditorCommand,
  executeCommand,
  fillTilesCommand,
  mergeDragCommands,
  moveEntitiesCommand,
  recordCommand,
  wrapBatch,
} from "../editor/commands.ts";
import {
  cancelPaste,
  confirmPaste,
  isPasting,
  updatePasteBlueprints,
} from "../editor/clipboard.ts";
import { sampleWaterLevelAtWorld } from "../editor/waterPicker.ts";

// Editor doodad drag state
let editorDragAnchor: Entity | null = null;
let editorDragEntities: Array<{
  entity: Entity;
  startPos: { x: number; y: number };
}> = [];

// Editor tile/cliff drag state
let editorTileDrag: {
  commands: EditorCommand[];
  visited: Set<string>;
  targetCliff?: number | "r";
} | null = null;

// Editor terrain-selection drag state. Active while the user is dragging out
// the rectangle for the Select tool. `moved` becomes true once the cursor
// changes cell, distinguishing a drag from a click that should clear the
// existing selection.
let editorSelectionDrag:
  | {
    startX: number;
    startY: number;
    moved: boolean;
    hadSelection: boolean;
  }
  | null = null;

// Editor paste drag state. While the mouse is held down in paste mode we
// commit a fresh paste every time the cursor crosses into a new cell, so the
// user can stamp a row of clipboards by dragging. Sub-commands accumulate
// across the drag and are merged into a single undo entry on mouseUp.
let editorPasteDrag:
  | { lastX: number; lastY: number; commands: EditorCommand[] }
  | null = null;

type TileBlueprint = NonNullable<ReturnType<typeof getBlueprint>>;

const computeWaterTarget = () =>
  Math.max(0, Math.round(editorWaterLevelVar() * WATER_LEVEL_SCALE));

// Build a single bulk command for the active terrain tool across the supplied
// cells. `targetCliff` is honored for raise/lower/ramp when set (plateau
// behavior); for ramp without a target it falls back to per-cell toggle.
// Returns null if nothing actually changes.
const buildBatchedChanges = (
  tool: TerrainTool | undefined,
  cellsIn: Cell[],
  targetCliff: number | "r" | undefined,
): EditorCommand | null => {
  // Restrict every brush / fill / all op to the active terrain selection.
  const cells = clipCellsToSelection(cellsIn) as Cell[];
  if (!cells.length) return null;

  if (editorTileModeVar() === "paintWater") {
    const newWater = computeWaterTarget();
    const water = terrain.masks.water;
    const updates: BulkSetWatersCommand["cells"] = [];
    for (const [x, y] of cells) {
      const old = water[y]?.[x];
      if (old === undefined || old === newWater) continue;
      updates.push({ x, y, oldWater: old, newWater });
    }
    return updates.length ? bulkSetWatersCommand(updates) : null;
  }

  const kind = tool?.kind;
  if (isCliffTool(kind)) {
    const cliffs = getCliffs();
    const updates: BulkSetCliffsCommand["cells"] = [];
    for (const [x, y] of cells) {
      const mapY = cliffs.length - 1 - y;
      const currentCliff = cliffs[mapY]?.[x];
      if (currentCliff === undefined) continue;
      const oldHeight = terrain.getCliff(x, y);
      let newCliff: number | "r";
      if (kind === "raise" || kind === "lower") {
        newCliff = typeof targetCliff === "number"
          ? targetCliff
          : oldHeight + (kind === "raise" ? 1 : -1);
        if (newCliff < 0) continue;
      } else if (kind === "plateau") {
        // Plateau: every cell in the brush gets the start cell's height.
        if (typeof targetCliff !== "number") continue;
        newCliff = targetCliff;
      } else if (targetCliff !== undefined) {
        newCliff = targetCliff;
      } else {
        newCliff = currentCliff === "r" ? oldHeight : "r";
      }
      if (currentCliff === newCliff) continue;
      updates.push({ x, y, oldCliff: currentCliff, newCliff });
    }
    return updates.length ? bulkSetCliffsCommand(updates) : null;
  }

  // Regular tile painting — group cells by their original tile so each
  // fillTilesCommand keeps a single (oldTile -> newTile) pair for undo.
  if (tool?.kind !== "tile") return null;
  const tileIndex = tileDefs.findIndex((t) => t.color === tool.color);
  if (tileIndex < 0) return null;
  const grid = terrain.masks.groundTile;
  const groups = Map.groupBy(
    cells.filter(([x, y]) => {
      const oldTile = grid[y]?.[x];
      return oldTile !== undefined && oldTile !== tileIndex;
    }),
    ([x, y]) => grid[y][x],
  );
  return wrapBatch(
    [...groups].map(([oldTile, gcells]) =>
      fillTilesCommand(
        gcells,
        oldTile,
        tileIndex,
        tileDefs[oldTile]?.pathing ?? 0,
        tileDefs[tileIndex].pathing,
      )
    ),
  );
};

// Build the command for "fill" or "all" at a click. "fill" selects cells
// matching the source value at the start cell (same tile, water level, or
// starting cliff height). "all" applies to every cell on the map.
const buildRegionCommand = (
  tool: TerrainTool | undefined,
  startX: number,
  startY: number,
  size: "fill" | "all",
): EditorCommand | null => {
  const { width, height } = getTileGridSize();
  if (width === 0 || height === 0) return null;

  const cells = getTileCells(
    size,
    editorBrushShapeVar(),
    startX,
    startY,
    fillsByCliff(editorTileModeVar(), tool?.kind),
  );
  return buildBatchedChanges(
    tool,
    cells,
    getRegionTarget(tool?.kind, startX, startY),
  );
};

// Cells not yet painted during the current drag, marking them painted
const takeUnvisited = (cells: Cell[]) =>
  cells.filter(([x, y]) => {
    const key = `${x},${y}`;
    if (editorTileDrag?.visited.has(key)) return false;
    editorTileDrag?.visited.add(key);
    return true;
  });

// Apply a brush stroke (size 1-5) at the given world position, executing one
// bulk command and returning it (or null if no cells changed).
const applyEditorTileChange = (
  blueprint: ReturnType<typeof getBlueprint>,
  worldX: number,
  worldY: number,
): EditorCommand | null => {
  if (!blueprint || blueprint.prefab !== "tile" || blueprint.owner) return null;

  if (editorTileModeVar() === "paintMask") {
    return applyEditorMaskChange(worldX, worldY);
  }

  const [normX, normY] = normalizeBuildPosition(worldX, worldY, "tile");

  const { width, height } = getTileGridSize();
  if (width === 0 || height === 0) return null;

  const size = editorBrushSizeVar();
  const cells = getTileCells(
    typeof size === "number" ? size : 1,
    editorBrushShapeVar(),
    normX - 0.5,
    normY - 0.5,
    false,
  );

  const cmd = buildBatchedChanges(
    getTerrainTool(),
    takeUnvisited(cells),
    editorTileDrag?.targetCliff,
  );
  if (cmd) doExecute(cmd);
  return cmd;
};

// Mask paint works in mask-grid space (see getMaskAnchor). Out-of-array cells
// (outside the boundary) are silently dropped — the documented "noop outside
// boundary" rule.
const applyEditorMaskChange = (
  worldX: number,
  worldY: number,
): EditorCommand | null => {
  const anchor = getMaskAnchor(worldX, worldY);
  if (anchor.shape.width === 0 || anchor.shape.height === 0) return null;

  const size = editorBrushSizeVar();
  const newValue = getTerrainTool()?.kind === "mask" ? 1 : 0;
  const mask = getMask();

  const cells = getMaskCells(size, editorBrushShapeVar(), anchor);

  const updates: BulkSetMasksCommand["cells"] = [];
  for (const [mapX, mapY] of takeUnvisited(cells)) {
    const old = mask[mapY]?.[mapX] ?? 0;
    if (old === newValue) continue;
    updates.push({ mapX, mapY, oldValue: old, newValue });
  }
  if (!updates.length) return null;
  const cmd = bulkSetMasksCommand(updates);
  doExecute(cmd);
  return cmd;
};

/** Cancels the water-level picker or a doodad paste. Returns true if one was active. */
export const cancelEditorPickOrPaste = (): boolean => {
  if (!editorVar()) return false;
  if (editorPickWaterLevelVar()) {
    editorPickWaterLevelVar(false);
    return true;
  }
  if (isPasting()) {
    cancelPaste();
    return true;
  }
  return false;
};

/** Commits the water-level picker or a doodad paste. Returns true if one was active. */
export const handleEditorLeftClick = (e: MouseButtonEvent): boolean => {
  if (!editorVar()) return false;
  if (editorPickWaterLevelVar()) {
    editorWaterLevelVar(sampleWaterLevelAtWorld(e.world.x, e.world.y));
    editorPickWaterLevelVar(false);
    return true;
  }
  if (isPasting()) {
    confirmPaste();
    return true;
  }
  return false;
};

/** Starts dragging a clicked doodad (and the rest of the selection when it is part of it). */
export const tryStartEditorDoodadDrag = (clickedEntity: Entity): boolean => {
  if (!editorVar() || !clickedEntity.isDoodad || !clickedEntity.position) {
    return false;
  }
  // If clicked entity is already selected, drag all selected doodads
  // Otherwise, select just this entity and drag it
  if (clickedEntity.selected && selection.size > 1) {
    editorDragEntities = [];
    for (const e of selection) {
      if (e.isDoodad && e.position) {
        editorDragEntities.push({
          entity: e,
          startPos: { x: e.position.x, y: e.position.y },
        });
      }
    }
  } else {
    editorDragEntities = [{
      entity: clickedEntity,
      startPos: { ...clickedEntity.position },
    }];
    selectEntity(clickedEntity, true, false);
  }
  editorDragAnchor = clickedEntity;
  return true;
};

/** Handles a click with an editor (ownerless) blueprint: places a doodad or starts a terrain tool. */
export const handleEditorBlueprintClick = (
  e: MouseButtonEvent,
  blueprint: NonNullable<ReturnType<typeof getBlueprint>>,
) => {
  const { id: _, position, isEffect: _e, preserveCursor: _p, ...entity } =
    blueprint;
  if (blueprint.prefab !== "tile") {
    const command = createEntityCommand(
      {
        ...entity,
        position: {
          x: Math.round(position!.x * 1000) / 1000,
          y: Math.round(position!.y * 1000) / 1000,
        },
      },
      entity.prefab,
    );
    executeCommand(command);
    pickDoodad(entity.prefab);
    return;
  }

  // Start tile drag
  const [normX, normY] = normalizeBuildPosition(e.world.x, e.world.y, "tile");
  const x = normX - 0.5;
  const y = normY - 0.5;

  const action = getTerrainTool()?.kind;
  if (action === "select") {
    // Stash the previous selection so a click-without-drag can clear it on
    // mouseUp. Don't mutate the selection yet — that way an unmoved click
    // doesn't replace the existing rect with a 1×1 stub.
    editorSelectionDrag = {
      startX: x,
      startY: y,
      moved: false,
      hadSelection: !!editorTerrainSelectionVar(),
    };
    return;
  }
  if (action === "paste") {
    const cmds = commitPaste();
    editorPasteDrag = { lastX: x, lastY: y, commands: cmds };
    return;
  }

  const brushSize = editorBrushSizeVar();
  const tool = getTerrainTool();

  // Mask paint handles its own fill/all (it operates in vertex/mask-grid
  // space, not tile-cell space) so don't route through buildRegionCommand.
  if (
    editorTileModeVar() !== "paintMask" &&
    (brushSize === "fill" || brushSize === "all")
  ) {
    const command = buildRegionCommand(tool, x, y, brushSize);
    if (command) executeCommand(command);
    return;
  }

  // Ramp drags toggle per cell, so only raise/lower/plateau level to a target
  const targetCliff = getLevelTarget(tool?.kind, x, y);

  editorTileDrag = {
    commands: [],
    visited: new Set(),
    targetCliff,
  };

  const command = applyEditorTileChange(blueprint, e.world.x, e.world.y);
  if (command) editorTileDrag.commands.push(command);
};

/** Finishes any editor drag on left mouse up. Returns true if one was active. */
export const handleEditorMouseUp = (): boolean => {
  if (editorPasteDrag) {
    // Collapse every stamp from this drag into a single undo entry. The merger
    // dedupes per-cell so a drag that retraces over the same cells still
    // restores the true pre-drag state.
    if (editorPasteDrag.commands.length > 0) {
      const merged = mergeDragCommands(editorPasteDrag.commands);
      if (merged) recordCommand(merged);
    }
    editorPasteDrag = null;
  } else if (editorSelectionDrag) {
    // Click without drag clears the existing selection (or starts a 1×1 if
    // there wasn't one). Drag finalizes the rectangle that mouseMove already
    // set on the var.
    if (!editorSelectionDrag.moved) {
      if (editorSelectionDrag.hadSelection) {
        clearTerrainSelection();
      } else {
        setSelectionFromDrag(
          editorSelectionDrag.startX,
          editorSelectionDrag.startY,
          editorSelectionDrag.startX,
          editorSelectionDrag.startY,
        );
      }
    }
    editorSelectionDrag = null;
  } else if (editorTileDrag) {
    // Finish editor tile/cliff drag - record all commands in undo stack (already executed).
    // Coalesce per-stroke bulk ops into one bulk per mask so undo stays cheap.
    if (editorTileDrag.commands.length > 0) {
      const merged = mergeDragCommands(editorTileDrag.commands);
      if (merged) recordCommand(merged);
    }
    editorTileDrag = null;
  } else if (editorDragEntities.length > 0) {
    // Finish editor doodad drag - send updates to server for entities that moved
    const movedEntities = editorDragEntities.filter(({ entity, startPos }) =>
      entity.position &&
      (entity.position.x !== startPos.x || entity.position.y !== startPos.y)
    );

    if (movedEntities.length > 0) {
      executeCommand(
        moveEntitiesCommand(
          movedEntities.map(({ entity, startPos }) => ({
            entityId: entity.id,
            fromX: startPos.x,
            fromY: startPos.y,
            toX: Math.round(entity.position!.x * 1000) / 1000,
            toY: Math.round(entity.position!.y * 1000) / 1000,
          })),
        ),
      );
    }
    editorDragAnchor = null;
    editorDragEntities = [];
  } else return false;
  return true;
};

export const handleEditorMouseMove = (e: MouseMoveEvent) => {
  // Handle editor paste preview
  if (editorVar() && isPasting()) {
    updatePasteBlueprints(e.world.x, e.world.y);
  }

  // Handle editor tile/cliff dragging
  if (editorTileDrag) {
    const blueprint = getBlueprint();
    const command = applyEditorTileChange(blueprint, e.world.x, e.world.y);
    if (command) editorTileDrag.commands.push(command);
  }

  // Handle editor terrain-selection dragging
  if (editorSelectionDrag) {
    const [nx, ny] = normalizeBuildPosition(e.world.x, e.world.y, "tile");
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    if (
      cx !== editorSelectionDrag.startX || cy !== editorSelectionDrag.startY
    ) {
      editorSelectionDrag.moved = true;
    }
    if (editorSelectionDrag.moved) {
      setSelectionFromDrag(
        editorSelectionDrag.startX,
        editorSelectionDrag.startY,
        cx,
        cy,
      );
    }
  }

  // Handle editor paste-stamp dragging: commit a fresh paste each time the
  // cursor crosses into a new cell so dragging stamps multiple copies.
  if (editorPasteDrag) {
    const [nx, ny] = normalizeBuildPosition(e.world.x, e.world.y, "tile");
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    if (cx !== editorPasteDrag.lastX || cy !== editorPasteDrag.lastY) {
      editorPasteDrag.lastX = cx;
      editorPasteDrag.lastY = cy;
      editorPasteDrag.commands.push(...commitPaste());
    }
  }

  // Handle editor doodad dragging
  if (editorDragAnchor && editorDragEntities.length > 0) {
    // Find the anchor's entry to calculate delta
    const anchorEntry = editorDragEntities.find((d) =>
      d.entity === editorDragAnchor
    );
    if (anchorEntry) {
      // Calculate snapped position for anchor based on its prefab
      const anchorPrefab = editorDragAnchor.prefab;
      const [anchorX, anchorY] = anchorPrefab
        ? normalizeBuildPosition(e.world.x, e.world.y, anchorPrefab)
        : [e.world.x, e.world.y];

      // Calculate delta from anchor's start position
      const deltaX = anchorX - anchorEntry.startPos.x;
      const deltaY = anchorY - anchorEntry.startPos.y;

      // Move each entity by the anchor's delta, then re-snap if it has its own snapping
      for (const { entity, startPos } of editorDragEntities) {
        if (entity.position) {
          // Apply anchor's delta
          let newX = startPos.x + deltaX;
          let newY = startPos.y + deltaY;

          // If entity has its own snapping, re-snap to ensure alignment
          if (entity.prefab && entity !== editorDragAnchor) {
            [newX, newY] = normalizeBuildPosition(newX, newY, entity.prefab);
          }

          entity.position = { x: newX, y: newY };
        }
      }
    }
  }
};
