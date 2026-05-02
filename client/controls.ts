import { mouse, MouseButtonEvent } from "./mouse.ts";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { send } from "./messaging.ts";
import { Entity } from "./ecs.ts";
import { addSystem } from "@/shared/context.ts";
import i18next from "i18next";
import { selection } from "./systems/selection.ts";
import { jumpToNextPing } from "./systems/indicators.ts";
import { camera, getSpeedMultiplier, terrain } from "./graphics/three.ts";
import { getEffectivePlayerGold, getLocalPlayer } from "./api/player.ts";
import { UnitDataAction, UnitDataActionTarget } from "@/shared/types.ts";
import { formatTargeting } from "@/shared/util/formatTargeting.ts";
import { findAction } from "@/shared/util/actionLookup.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { canBuild } from "./api/unit.ts";
import { findAutoTarget } from "@/shared/util/autoTargeting.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { playSound } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { showFeedback } from "@/vars/feedback.ts";
import { stateVar } from "@/vars/state.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { isSoftwareRenderer } from "./util/gpu.ts";
import { selectEntity, selectPrimaryUnit } from "./api/selection.ts";
import { selectionFocusVar } from "@/vars/selectionFocus.ts";
import { handleControlGroupKey } from "./api/controlGroups.ts";
import { applyZoom, setZoom, showZoomMessage } from "./api/player.ts";
import {
  closeAllMenus,
  closeMenu,
  getCurrentMenu,
  openMenu,
} from "@/vars/menuState.ts";
import {
  cancelBlueprint,
  clearBlueprint as clearBlueprintHandler,
  createBlueprint,
  getBlueprint,
  getBlueprintPrefab,
  getBuilderFromBlueprint,
  hasBlueprint as hasBlueprintHandler,
  normalizeBuildPosition,
  updateBlueprint,
} from "./controls/blueprintHandlers.ts";
import {
  cancelOrder as cancelOrderHandler,
  getActiveOrder,
  handleSmartTarget,
  handleTargetOrder,
  playOrderSound,
  queued,
  setActiveOrder,
} from "./controls/orderHandlers.ts";
import {
  checkShortcut,
  clearKeyboard,
  findActionForShortcut,
  handleKeyDown,
  handleKeyUp,
  keyboard,
} from "./controls/keyboardHandlers.ts";
import {
  cleanupSelectionState,
  dragStart,
  handleDragSelectionOnMouseUp,
  handleEntitySelectionOnMouseUp,
  pendingEntityClick,
  selectionEntity,
  setDragStart,
  setLastClickedEntity,
  setLastEntityClickTime,
  setPendingEntityClick,
  updateSelectionRectangle,
} from "./controls/selection.ts";
import {
  getCliffs,
  getMap,
  getMask,
  getMaskShapeForBounds,
} from "@/shared/map.ts";
import { SystemEntity } from "./ecs.ts";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import {
  editorActiveActionVar,
  editorBrushShapeVar,
  editorBrushSizeVar,
  editorPickWaterLevelVar,
  editorTerrainClipboardVar,
  editorTerrainSelectionVar,
  editorTileModeVar,
  editorVar,
  editorWaterLevelVar,
} from "@/vars/editor.ts";
import {
  type Cell,
  getAllCells,
  getBrushCells,
  getFloodFillCells,
} from "./editor/brush.ts";
import "./editor/brushPreview.ts";
import {
  clearTerrainSelection,
  clipCellsToSelection,
  commitPaste,
  copyTerrainSelection,
  setSelectionFromDrag,
} from "./editor/selection.ts";
import { WATER_LEVEL_SCALE } from "@/shared/constants.ts";
import { pickDoodad } from "./ui/views/Game/Editor/DoodadsPanel.tsx";
import { tileDefs } from "@/shared/data.ts";
import {
  batchCommand,
  type BulkSetCliffsCommand,
  bulkSetCliffsCommand,
  type BulkSetMasksCommand,
  bulkSetMasksCommand,
  type BulkSetWatersCommand,
  bulkSetWatersCommand,
  createEntityCommand,
  deleteEntityCommand,
  doExecute,
  type EditorCommand,
  executeCommand,
  fillTilesCommand,
  keyboardMoveCommand,
  mergeDragCommands,
  moveEntitiesCommand,
  recordCommand,
  redo,
  undo,
  undoLastStep,
} from "./editor/commands.ts";
import {
  cancelPaste,
  confirmPaste,
  copySelectedDoodads,
  isPasting,
  startPaste,
  updatePasteBlueprints,
} from "./editor/clipboard.ts";
import { sampleWaterLevelAtWorld } from "./editor/waterPicker.ts";

// Re-export for external use
export const clearBlueprint = clearBlueprintHandler;
export const hasBlueprint = hasBlueprintHandler;

const getGroupKey = (entity: Entity): string =>
  entity.unique ? `unique:${entity.id}` : `prefab:${entity.prefab ?? "none"}`;

const cycleSelectionFocus = () => {
  const current = selectionFocusVar();
  const groups = new Map<string, Entity[]>();
  for (const entity of selection) {
    const key = getGroupKey(entity);
    const group = groups.get(key) ?? [];
    group.push(entity);
    groups.set(key, group);
  }
  if (groups.size <= 1) return;

  const keys = [...groups.keys()];
  const currentKey = current ? getGroupKey(current) : undefined;
  const currentIndex = currentKey ? keys.indexOf(currentKey) : -1;
  const nextIndex = (currentIndex + 1) % keys.length;
  const nextGroup = groups.get(keys[nextIndex])!;
  selectionFocusVar(nextGroup[0]);
};

const getTargetingMessage = (orderName: string): string => {
  for (const entity of selection) {
    const action = findAction(
      entity,
      (a): a is UnitDataActionTarget =>
        a.type === "target" && a.order === orderName,
    );
    if (!action) continue;

    const targeting = action.targeting;
    if (targeting?.length) return formatTargeting(targeting);
  }

  return "Invalid target";
};
export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  if (check && !check(getActiveOrder()?.order, getBlueprintPrefab())) return;
  cancelOrderHandler(check);
  cancelBlueprint();
};

/** Checks if an element should pass through clicks to the game canvas */
const isGameElement = (element: Element | null): boolean => {
  if (!element) return false;
  const gameUiAncestor = element.closest("[data-game-ui]");
  return gameUiAncestor !== null &&
    (gameUiAncestor === element || gameUiAncestor.id !== "ui");
};

// Set getters on mouse object for event state capture
mouse.getActiveOrder = getActiveOrder;
mouse.getBlueprint = getBlueprint;

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

// Middle-click camera panning state
let panGrabPixels: { x: number; y: number } | null = null;

// Simulated :active state
const actives: Element[] = [];
const clearActives = () => {
  for (const el of actives) el.classList.remove("active");
  actives.length = 0;
};

// Mouse event handlers
mouse.addEventListener("mouseButtonDown", (e) => {
  // Handle focus/blur for UI elements
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== e.element
  ) document.activeElement.blur();

  if (
    (e.element instanceof HTMLElement || e.element instanceof SVGElement)
  ) {
    const passThrough = isGameElement(e.element);
    if (!passThrough) e.element.focus();

    // Simulate :active on the element and its ancestors
    clearActives();
    for (
      let el: Element | null = e.element;
      el;
      el = el.parentElement
    ) {
      el.classList.add("active");
      actives.push(el);
    }

    e.element.dispatchEvent(
      new MouseEvent("mousedown", {
        view: window,
        bubbles: true,
        cancelable: true,
        button: e.button === "left" ? 0 : e.button === "middle" ? 1 : 2,
      }),
    );
    if (!passThrough) return;
  }

  if (e.button === "right") {
    // Cancel water-level picker on right click
    if (editorVar() && editorPickWaterLevelVar()) {
      editorPickWaterLevelVar(false);
      return;
    }
    // Cancel paste on right click
    if (editorVar() && isPasting()) {
      cancelPaste();
      return;
    }
    // Check if we should clear active orders/blueprints on right click
    const activeOrder = getActiveOrder();
    const hadBlueprint = hasBlueprint();

    // Non-blocking = build order or target order with AOE (allows ground)
    // aoe: 0 is still a valid AOE (attack-ground), so check typeof === "number"
    const isNonBlocking = hadBlueprint ||
      (activeOrder && typeof activeOrder.aoe === "number");

    if (isNonBlocking) {
      if (gameplaySettingsVar().clearOrderOnRightClick) cancelOrder();
    } else if (activeOrder) {
      // Blocking order = target order without AOE (requires unit target)
      // Always clear blocking orders on right click
      cancelOrder();
    }
    if (selection.size) {
      playOrderSound(e.world.x, e.world.y);
      handleSmartTarget(e);
    }
  } else if (e.button === "left") handleLeftClick(e);
  else if (e.button === "middle") {
    panGrabPixels = { x: e.pixels.x, y: e.pixels.y };
  }
});

const handleLeftClick = (e: MouseButtonEvent) => {
  // Water-level picker: sample under cursor, commit, exit picker.
  if (editorVar() && editorPickWaterLevelVar()) {
    editorWaterLevelVar(sampleWaterLevelAtWorld(e.world.x, e.world.y));
    editorPickWaterLevelVar(false);
    return;
  }

  // Handle editor paste confirmation
  if (editorVar() && isPasting()) {
    confirmPaste();
    return;
  }

  const blueprint = getBlueprint();

  // Don't handle entity selection/deselection on minimap
  const isMinimapClick = e.element instanceof HTMLElement &&
    e.element.hasAttribute("data-minimap");

  if (blueprint) {
    handleBlueprintClick(e);
    setLastClickedEntity(null);
    setLastEntityClickTime(0);
  } else if (getActiveOrder()) {
    const result = handleTargetOrder(e);
    if (!result.success) {
      playSound("ui", pick("error1"), { volume: 0.3 });
      showFeedback(
        result.reason === "out-of-range"
          ? "Target is out of range"
          : getTargetingMessage(getActiveOrder()!.order),
      );
    }
    setLastClickedEntity(null);
    setLastEntityClickTime(0);
  } else if (e.intersects.size && !isMinimapClick) {
    const clickedEntity = e.intersects.first()!;
    const now = performance.now();

    // In editor mode, start dragging if clicking on a doodad
    if (editorVar() && clickedEntity.isDoodad && clickedEntity.position) {
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
      setLastEntityClickTime(now);
      setLastClickedEntity(clickedEntity);
      return;
    }

    // Defer entity selection to mouse up
    setPendingEntityClick({
      entity: clickedEntity,
      time: now,
      startPixels: { x: e.pixels.x, y: e.pixels.y },
    });
    // Also set dragStart so selection rectangle can initiate from entity clicks
    setDragStart({ x: e.world.x, y: e.world.y });
  } else if (!isMinimapClick) {
    setDragStart({ x: e.world.x, y: e.world.y });
    setLastClickedEntity(null);
    setLastEntityClickTime(0);
  }
};

type TileBlueprint = NonNullable<ReturnType<typeof getBlueprint>>;

const computeWaterTarget = () =>
  Math.max(0, Math.round(editorWaterLevelVar() * WATER_LEVEL_SCALE));

const wrapBatch = (commands: EditorCommand[]): EditorCommand | null => {
  if (commands.length === 0) return null;
  if (commands.length === 1) return commands[0];
  return batchCommand(commands);
};

const getMaskDimensions = () => {
  const grid = terrain.masks.groundTile;
  return { width: grid[0]?.length ?? 0, height: grid.length };
};

// Build a single bulk command for the current blueprint operation across the
// supplied cells. `targetCliff` is honored for raise/lower/ramp when set
// (plateau behavior); for ramp without a target it falls back to per-cell
// toggle. Returns null if nothing actually changes.
const buildBatchedChanges = (
  blueprint: TileBlueprint,
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

  const vc = blueprint.vertexColor;
  if (
    vc === 0xff01ff || vc === 0xff02ff || vc === 0xff03ff || vc === 0xff04ff
  ) {
    const cliffs = getCliffs();
    const updates: BulkSetCliffsCommand["cells"] = [];
    for (const [x, y] of cells) {
      const mapY = cliffs.length - 1 - y;
      const currentCliff = cliffs[mapY]?.[x];
      if (currentCliff === undefined) continue;
      const oldHeight = terrain.getCliff(x, y);
      let newCliff: number | "r";
      if (vc === 0xff01ff || vc === 0xff02ff) {
        newCliff = typeof targetCliff === "number"
          ? targetCliff
          : oldHeight + (vc === 0xff01ff ? 1 : -1);
        if (newCliff < 0) continue;
      } else if (vc === 0xff04ff) {
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
  const tileIndex = tileDefs.findIndex((t) => t.color === vc);
  if (tileIndex < 0) return null;
  const grid = terrain.masks.groundTile;
  const newPathing = blueprint.pathing!;
  const groups = new Map<number, Cell[]>();
  for (const [x, y] of cells) {
    const oldTile = grid[y]?.[x];
    if (oldTile === undefined || oldTile === tileIndex) continue;
    const list = groups.get(oldTile);
    if (list) list.push([x, y]);
    else groups.set(oldTile, [[x, y]]);
  }
  const subs = [...groups].map(([oldTile, gcells]) =>
    fillTilesCommand(
      gcells,
      oldTile,
      tileIndex,
      tileDefs[oldTile]?.pathing ?? 0,
      newPathing,
    )
  );
  return wrapBatch(subs);
};

// Build the command for "fill" or "all" at a click. "fill" selects cells
// matching the source value at the start cell (same tile, water level, or
// starting cliff height). "all" applies to every cell on the map.
const buildRegionCommand = (
  blueprint: TileBlueprint,
  startX: number,
  startY: number,
  size: "fill" | "all",
): EditorCommand | null => {
  const { width, height } = getMaskDimensions();
  if (width === 0 || height === 0) return null;

  let cells: Cell[];
  if (size === "all") {
    cells = getAllCells(width, height);
  } else if (
    editorTileModeVar() === "paintWater" ||
    blueprint.vertexColor === 0xff01ff ||
    blueprint.vertexColor === 0xff02ff ||
    blueprint.vertexColor === 0xff03ff ||
    blueprint.vertexColor === 0xff04ff
  ) {
    // Both water and cliff/ramp fills follow cliff height — water fill walks
    // the basin defined by surrounding cliffs, not the existing water mask.
    cells = getFloodFillCells(
      startX,
      startY,
      width,
      height,
      (x, y) => terrain.getCliff(x, y),
    );
  } else {
    const grid = terrain.masks.groundTile;
    cells = getFloodFillCells(
      startX,
      startY,
      width,
      height,
      (x, y) => grid[y][x],
    );
  }

  return buildBatchedChanges(
    blueprint,
    cells,
    computeFillTargetCliff(blueprint, startX, startY),
  );
};

// Plateau target for cliff/ramp ops anchored at the start cell.
const computeFillTargetCliff = (
  blueprint: TileBlueprint,
  startX: number,
  startY: number,
): number | "r" | undefined => {
  const vc = blueprint.vertexColor;
  if (vc === 0xff01ff) return terrain.getCliff(startX, startY) + 1;
  if (vc === 0xff02ff) return terrain.getCliff(startX, startY) - 1;
  if (vc === 0xff04ff) return terrain.getCliff(startX, startY);
  if (vc === 0xff03ff) {
    const cliffs = getCliffs();
    const startMapY = cliffs.length - 1 - startY;
    const startCurrent = cliffs[startMapY]?.[startX];
    if (startCurrent === undefined) return undefined;
    return startCurrent === "r" ? terrain.getCliff(startX, startY) : "r";
  }
  return undefined;
};

// Apply a brush stroke (size 1-5) at the given world position, executing one
// bulk command and returning it (or null if no cells changed).
const applyEditorTileChange = (
  blueprint: ReturnType<typeof getBlueprint>,
  worldX: number,
  worldY: number,
): EditorCommand | null => {
  if (!blueprint || blueprint.prefab !== "tile" || blueprint.owner) return null;

  if (editorTileModeVar() === "paintMask") {
    return applyEditorMaskChange(blueprint, worldX, worldY);
  }

  const [normX, normY] = normalizeBuildPosition(worldX, worldY, "tile");
  const cx = normX - 0.5;
  const cy = normY - 0.5;

  const { width, height } = getMaskDimensions();
  if (width === 0 || height === 0) return null;

  const size = editorBrushSizeVar();
  const brushSize = typeof size === "number" ? size : 1;
  const cells = getBrushCells(
    cx,
    cy,
    brushSize,
    editorBrushShapeVar(),
    width,
    height,
  );

  const newCells: Cell[] = [];
  for (const cell of cells) {
    const key = `${cell[0]},${cell[1]}`;
    if (editorTileDrag?.visited.has(key)) continue;
    editorTileDrag?.visited.add(key);
    newCells.push(cell);
  }

  const cmd = buildBatchedChanges(
    blueprint,
    newCells,
    editorTileDrag?.targetCliff,
  );
  if (cmd) doExecute(cmd);
  return cmd;
};

/**
 * Mask paint mode is special: cells live on cliff vertices anchored to the
 * boundary, not on tile centers. World (worldX, worldY) maps to the nearest
 * vertex (round to integer), then to mask-array indices via the bounds anchor.
 * Brush sizes paint in mask-grid space; out-of-array cells (outside the
 * boundary) are silently dropped — that's the documented "noop outside
 * boundary" rule.
 */
const applyEditorMaskChange = (
  blueprint: ReturnType<typeof getBlueprint>,
  worldX: number,
  worldY: number,
): EditorCommand | null => {
  const map = getMap();
  const shape = getMaskShapeForBounds(map.bounds);
  if (shape.width === 0 || shape.height === 0) return null;

  const vx = Math.round(worldX);
  const vy = Math.round(worldY);
  const centerMapX = vx - shape.firstVertexX;
  const centerMapY = shape.topVertexY - vy;

  const size = editorBrushSizeVar();
  const newValue = blueprint?.vertexColor === 0xff07ff ? 1 : 0;
  const mask = getMask();

  let cells: Cell[];
  if (size === "all") {
    cells = getAllCells(shape.width, shape.height);
  } else if (size === "fill") {
    if (
      centerMapX < 0 || centerMapX >= shape.width ||
      centerMapY < 0 || centerMapY >= shape.height
    ) return null;
    cells = getFloodFillCells(
      centerMapX,
      centerMapY,
      shape.width,
      shape.height,
      (x, y) => mask[y]?.[x] ?? 0,
    );
  } else {
    const brushSize = typeof size === "number" ? size : 1;
    cells = getBrushCells(
      centerMapX,
      centerMapY,
      brushSize,
      editorBrushShapeVar(),
      shape.width,
      shape.height,
    );
  }

  const updates: BulkSetMasksCommand["cells"] = [];
  for (const [mapX, mapY] of cells) {
    const key = `${mapX},${mapY}`;
    if (editorTileDrag?.visited.has(key)) continue;
    editorTileDrag?.visited.add(key);
    const old = mask[mapY]?.[mapX] ?? 0;
    if (old === newValue) continue;
    updates.push({ mapX, mapY, oldValue: old, newValue });
  }
  if (!updates.length) return null;
  const cmd = bulkSetMasksCommand(updates);
  doExecute(cmd);
  return cmd;
};

const handleBlueprintClick = (e: MouseButtonEvent) => {
  const blueprint = getBlueprint();
  if (!blueprint) return;

  if (blueprint.prefab === "ping") {
    send({ type: "mapPing", x: e.world.x, y: e.world.y });
    cancelBlueprint();
    return;
  }

  if (editorVar() && !blueprint.owner) {
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

    const action = editorActiveActionVar()?.kind;
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
    const isMaskPaint = editorTileModeVar() === "paintMask";

    // Mask paint handles its own fill/all (it operates in vertex/mask-grid
    // space, not tile-cell space) so don't route through buildRegionCommand.
    if (!isMaskPaint && (brushSize === "fill" || brushSize === "all")) {
      const command = buildRegionCommand(blueprint, x, y, brushSize);
      if (command) executeCommand(command);
      return;
    }

    // Plateau target for raise/lower/plateau brushes (ramp drag toggles per
    // cell, so it intentionally leaves targetCliff undefined). Irrelevant for
    // mask paint.
    let targetCliff: number | undefined;
    if (!isMaskPaint) {
      if (blueprint.vertexColor === 0xff01ff) {
        targetCliff = terrain.getCliff(x, y) + 1;
      } else if (blueprint.vertexColor === 0xff02ff) {
        targetCliff = terrain.getCliff(x, y) - 1;
      } else if (blueprint.vertexColor === 0xff04ff) {
        targetCliff = terrain.getCliff(x, y);
      }
    }

    editorTileDrag = {
      commands: [],
      visited: new Set(),
      targetCliff,
    };

    const command = applyEditorTileChange(blueprint, e.world.x, e.world.y);
    if (command) editorTileDrag.commands.push(command);

    return;
  }

  const prefab = blueprint.prefab;
  const unit = getBuilderFromBlueprint();
  if (!unit) return;

  const [x, y] = normalizeBuildPosition(e.world.x, e.world.y, prefab);

  if (!canBuild(unit, prefab, x, y)) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    showFeedback(i18next.t("hud.cannotBuildThere"));
    return;
  }

  if (!e.queue) cancelBlueprint();
  else queued.state = true;

  if (selection.size) {
    const source = selection.first()?.position;
    if (source) playOrderSound(e.world.x, e.world.y);
  }

  send({
    type: "build",
    unit: unit.id,
    buildType: prefab,
    x,
    y,
    queue: e.queue,
  });
};

mouse.addEventListener("mouseButtonUp", (e) => {
  clearActives();

  // Emit mouseup and click/contextmenu to UI elements
  // Only dispatch synthetic events when pointer lock is active; without it,
  // native browser events already reach the elements and dispatching would
  // double-fire.
  if (
    document.pointerLockElement &&
    (e.element instanceof HTMLElement || e.element instanceof SVGElement) &&
    !isGameElement(e.element)
  ) {
    e.element.dispatchEvent(
      new MouseEvent("mouseup", {
        view: window,
        bubbles: true,
        cancelable: true,
        button: e.button === "left" ? 0 : e.button === "middle" ? 1 : 2,
      }),
    );
    if (e.button === "right") {
      e.element.dispatchEvent(
        new MouseEvent("contextmenu", {
          view: window,
          bubbles: true,
          cancelable: true,
          button: 2,
        }),
      );
    } else if ("click" in e.element) e.element.click();
    else {
      e.element.dispatchEvent(
        new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }

  if (e.button === "middle") panGrabPixels = null;
  else if (e.button === "left" && editorPasteDrag) {
    // Collapse every stamp from this drag into a single undo entry. The merger
    // dedupes per-cell so a drag that retraces over the same cells still
    // restores the true pre-drag state.
    if (editorPasteDrag.commands.length > 0) {
      const merged = mergeDragCommands(editorPasteDrag.commands);
      if (merged) recordCommand(merged);
    }
    editorPasteDrag = null;
  } else if (e.button === "left" && editorSelectionDrag) {
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
  } else if (e.button === "left" && editorTileDrag) {
    // Finish editor tile/cliff drag - record all commands in undo stack (already executed).
    // Coalesce per-stroke bulk ops into one bulk per mask so undo stays cheap.
    if (editorTileDrag.commands.length > 0) {
      const merged = mergeDragCommands(editorTileDrag.commands);
      if (merged) recordCommand(merged);
    }
    editorTileDrag = null;
  } else if (e.button === "left" && editorDragEntities.length > 0) {
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
  } else if (e.button === "left" && selectionEntity && dragStart) {
    handleDragSelectionOnMouseUp(e.world.x, e.world.y);
  } else if (e.button === "left" && pendingEntityClick) {
    handleEntitySelectionOnMouseUp(e.pixels.x, e.pixels.y);
  }
  cleanupSelectionState();
});

// Mouse move handler
let hover: Element | null = null;
let hovers: Element[] = [];

mouse.addEventListener("mouseMove", (e) => {
  updateBlueprint(e.world.x, e.world.y);

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

  // Handle selection rectangle dragging
  if (dragStart && !getBlueprint() && !getActiveOrder()) {
    updateSelectionRectangle(e.world.x, e.world.y);
  }

  // Handle hover events
  if (hover !== e.element) {
    hover?.dispatchEvent(
      new MouseEvent("mouseout", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    e.element?.dispatchEvent(
      new MouseEvent("mouseover", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
    hover = e.element;
  }

  // Handle hover classes
  // Find if there's an overlay in the element stack
  const overlayIndex = e.elements.findIndex((el) =>
    el instanceof HTMLElement && el.dataset.overlay === "true"
  );

  // Filter elements: if overlay exists, only keep elements before it (on top of overlay)
  const hoverableElements = overlayIndex >= 0
    ? e.elements.slice(0, overlayIndex)
    : e.elements;

  // Remove hover from elements no longer in the hoverable set
  for (const el of hovers) {
    if (!hoverableElements.includes(el)) el?.classList.remove("hover");
  }

  // Add hover to new hoverable elements
  for (const el of hoverableElements) {
    if (!hovers.includes(el)) el.classList.add("hover");
  }

  hovers = hoverableElements;

  updateCursor(true);
});

// Keyboard event handlers
document.addEventListener("keydown", (e) => {
  handleKeyDown(e.code);

  // Block Tab to prevent focus leaving the game (e.g., to URL bar)
  if (e.key === "Tab") e.preventDefault();

  // Block browser shortcuts that disrupt gameplay (but not when typing in inputs)
  const inInput = document.activeElement?.tagName === "INPUT";
  if (e.ctrlKey || e.metaKey) {
    const blocked = [
      "KeyA",
      "KeyD",
      "KeyF",
      "KeyG",
      "KeyL",
      "KeyN",
      "KeyO",
      "KeyP",
      "KeyS",
      "KeyT",
    ];
    if (blocked.includes(e.code) && !inInput) e.preventDefault();
  }
  if (e.key === "F1") e.preventDefault();
  if (e.key === "Backspace" && !inInput) e.preventDefault();

  if (showSettingsVar()) return false;

  const shortcuts = shortcutsVar();

  if (document.activeElement?.tagName === "INPUT") return false;

  // Handle editor undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Alt+Z)
  if (editorVar() && (e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else if (e.altKey) undoLastStep();
    else undo();
    return false;
  }

  // Handle editor copy/cut/paste (Ctrl+C / Ctrl+X / Ctrl+V). Terrain
  // selection takes precedence over doodad selection when both could match.
  if (editorVar() && (e.ctrlKey || e.metaKey)) {
    if (e.code === "KeyC") {
      e.preventDefault();
      if (editorTerrainSelectionVar()) copyTerrainSelection();
      else copySelectedDoodads(false);
      return false;
    }
    if (e.code === "KeyX") {
      e.preventDefault();
      copySelectedDoodads(true);
      return false;
    }
    if (e.code === "KeyV") {
      e.preventDefault();
      if (editorTerrainClipboardVar()) {
        // Switch to terrain paste mode — a hidden tile blueprint tracks the
        // cursor so the SelectionOverlay's stamp follows it.
        const blueprint = createBlueprint(
          "tile",
          mouse.world.x,
          mouse.world.y,
        );
        if (blueprint) {
          blueprint.vertexColor = 0xff06ff;
          blueprint.isDoodad = true;
          blueprint.alpha = 0;
          editorActiveActionVar({ kind: "paste" });
        }
      } else startPaste();
      return false;
    }
  }

  // Handle UI shortcuts
  if (handleUIShortcuts(e, shortcuts)) return false;

  // Skip if in chat or command palette
  if (shouldSkipGameShortcuts(e)) return false;

  // Handle action shortcuts
  const { units, action } = findActionForShortcut(e, shortcuts);

  // Handle ping shortcut
  if (checkShortcut(shortcuts.misc, "ping", e.code)) {
    e.preventDefault();
    // Create ping blueprint at current mouse position
    createBlueprint("ping", mouse.world.x, mouse.world.y);
    return false;
  }

  if (!action) {
    // Handle cancel
    if (checkShortcut(shortcuts.misc, "cancel", e.code)) {
      // Cancel water-level picker if active
      if (editorVar() && editorPickWaterLevelVar()) {
        editorPickWaterLevelVar(false);
        return false;
      }
      // Cancel paste mode if active
      if (editorVar() && isPasting()) {
        cancelPaste();
        return false;
      }
      // Cancel terrain paste / clear terrain selection in the editor before
      // falling back to the generic cancel-order path.
      if (editorVar() && editorActiveActionVar()?.kind === "paste") {
        cancelBlueprint();
        return false;
      }
      if (editorVar() && editorTerrainSelectionVar()) {
        clearTerrainSelection();
        return false;
      }
      cancelOrder();
      return false;
    }
    return;
  }

  handleAction(action, units);
});

const handleUIShortcuts = (
  e: KeyboardEvent,
  shortcuts: Record<string, Record<string, string[]>>,
): boolean => {
  // Skip if in input field
  if (
    document.activeElement instanceof HTMLInputElement &&
    (document.activeElement.value || e.shiftKey || e.ctrlKey || e.metaKey)
  ) {
    return true;
  }

  // Command palette
  if (
    checkShortcut(shortcuts.misc, "openCommandPalette", e.code) &&
    showCommandPaletteVar() === "closed"
  ) {
    e.preventDefault();
    showCommandPaletteVar("open");
    return true;
  }

  // Chat
  if (
    checkShortcut(shortcuts.misc, "openChat", e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    showChatBoxVar("open");
    return true;
  }

  // Control groups
  if (
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    handleControlGroupKey(e);
  }

  // Cycle selection focus through prefab groups
  if (
    checkShortcut(shortcuts.misc, "cycleSelection", e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing" &&
    selection.size > 1
  ) {
    e.preventDefault();
    cycleSelectionFocus();
    return true;
  }

  if (
    checkShortcut(shortcuts.misc, "jumpToPing", e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    if (jumpToNextPing()) e.preventDefault();
  }

  if (
    checkShortcut(shortcuts.misc, "applyZoom", e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing" &&
    !editorVar()
  ) {
    e.preventDefault();
    applyZoom();
  }

  return false;
};

const shouldSkipGameShortcuts = (e: KeyboardEvent): boolean => {
  if (
    (showChatBoxVar() === "open" || showCommandPaletteVar() === "open") &&
    !("fromHud" in e)
  ) {
    if (
      showCommandPaletteVar() === "open" &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      e.preventDefault();
    }
    return true;
  }
  return false;
};

const handleAction = (action: UnitDataAction, units: Entity[]) => {
  const queue = checkShortcut(shortcutsVar().misc, "queueModifier") > 0;

  if (!queue) cancelOrder();
  else queued.state = true;

  units = units.filter((unit) => {
    const isConstructing = typeof unit.progress === "number";
    if (!isConstructing) return true;
    const canExecute = "canExecuteWhileConstructing" in action &&
      action.canExecuteWhileConstructing === true;
    return canExecute;
  });
  if (!units.length) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    showFeedback(i18next.t("hud.unitIsBusy"));
    return;
  }

  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  units = units.filter((unit) => (unit.mana ?? 0) >= manaCost);
  if (!units.length) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    showFeedback(i18next.t("hud.notEnoughMana"));
    return;
  }

  if ("goldCost" in action && action.goldCost && units.length) {
    const playerGold = getEffectivePlayerGold(units[0].owner);
    if (playerGold < action.goldCost) {
      playSound("ui", pick("error1"), { volume: 0.3 });
      showFeedback(i18next.t("hud.notEnoughGold"));
      return;
    }
  }

  switch (action.type) {
    case "auto":
      handleAutoAction(action, units, queue);
      break;
    case "build":
      createBlueprint(action.unitType, mouse.world.x, mouse.world.y);
      break;
    case "upgrade":
      send({
        type: "upgrade",
        units: units.map((u) => u.id),
        prefab: action.prefab,
        queue,
      });
      if (action.prefab === "illusionHut") selectPrimaryUnit();
      break;
    case "target":
      setActiveOrder(
        action.order,
        action.order === "attack" || action.order === "attack-ground" ||
          action.order === "meteor"
          ? "enemy"
          : "ally",
        action.aoe,
      );
      break;
    case "purchase":
      playSound("ui", pick("click1", "click2", "click3", "click4"), {
        volume: 0.3,
      });
      send({
        type: "purchase",
        unit: units[0].id,
        itemId: action.itemId,
        queue,
      });
      break;
    case "menu":
      playSound("ui", pick("click1", "click2", "click3", "click4"), {
        volume: 0.1,
      });
      openMenu(action, units[0].id);
      return;
    default:
      absurd(action);
  }

  closeAllMenus();
};

const handleAutoAction = (
  action: Extract<UnitDataAction, { type: "auto" }>,
  units: Entity[],
  queue?: boolean,
) => {
  // Handle special "back" order for closing menus
  if (action.order === "back" && getCurrentMenu()) {
    playSound("ui", pick("click1", "click2", "click3", "click4"), {
      volume: 0.1,
    });
    closeMenu();
    return;
  }

  // Handle editor-specific orders through the command system
  if (editorVar() && units.length > 0) {
    const order = action.order;

    // Editor delete - batch multiple deletes into one command
    if (order === "editorRemoveEntity") {
      const commands: EditorCommand[] = units.map((unit) => {
        // Only include safe properties for delete command
        const entityData: Record<string, unknown> = {};
        const safeProps = [
          "prefab",
          "position",
          "facing",
          "modelScale",
          "playerColor",
          "vertexColor",
          "model",
          "isDoodad",
          "radius",
          "type",
        ];
        for (const prop of safeProps) {
          if ((unit as Record<string, unknown>)[prop] !== undefined) {
            entityData[prop] = (unit as Record<string, unknown>)[prop];
          }
        }
        return deleteEntityCommand(unit.id, entityData);
      });

      if (commands.length > 0) {
        executeCommand(
          commands.length === 1 ? commands[0] : batchCommand(commands),
        );
      }
      return;
    }

    // Editor keyboard move - batch multiple moves into one command
    const moveDir = order === "editorMoveEntityUp"
      ? "up"
      : order === "editorMoveEntityDown"
      ? "down"
      : order === "editorMoveEntityLeft"
      ? "left"
      : order === "editorMoveEntityRight"
      ? "right"
      : null;
    if (moveDir) {
      const commands: EditorCommand[] = units
        .filter((unit) => unit.position)
        .map((unit) =>
          keyboardMoveCommand(
            unit.id,
            moveDir,
            unit.position!.x,
            unit.position!.y,
          )
        );

      if (commands.length > 0) {
        executeCommand(
          commands.length === 1 ? commands[0] : batchCommand(commands),
        );
      }
      return;
    }
  }

  // Handle auto-targeting actions (e.g., crystal buffs)
  if (action.targeting && units.length > 0) {
    const localPlayer = getLocalPlayer();
    if (!localPlayer) return;

    // Select caster with most mana
    const caster = units.reduce((best, unit) =>
      (unit.mana ?? 0) > (best.mana ?? 0) ? unit : best
    );

    const range = action.range ?? 5;
    const target = findAutoTarget(
      caster,
      range,
      action.targeting,
      action.buffName,
      localPlayer.id,
    );
    if (!target) {
      playSound("ui", pick("error1"), { volume: 0.3 });
      showFeedback(i18next.t("hud.noValidTargets"));
      return;
    }

    if (caster.position) {
      playOrderSound(caster.position.x, caster.position.y);
    } else {
      playOrderSound();
    }

    send({
      type: "unitOrder",
      order: action.order,
      units: [caster.id],
      target: target.id,
      queue,
    });
    return;
  }

  if (units.length > 0 && units[0].position) {
    playOrderSound(units[0].position.x, units[0].position.y);
  } else {
    playOrderSound();
  }

  send({
    type: "unitOrder",
    order: action.order,
    units: units.map((u) => u.id),
    prefab: action.prefab,
    queue,
  });
};

document.addEventListener("keyup", (e) => {
  handleKeyUp(e.code);
  if (
    queued.state &&
    !checkShortcut(shortcutsVar().misc, "queueModifier")
  ) cancelOrder();
});

// Indirect since clearKeyboard has not yet be initialized due to circular imports
globalThis.addEventListener("blur", () => clearKeyboard());

// Camera controls
let zoomTimeout = 0;
globalThis.addEventListener("wheel", (e) => {
  const element = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y);
  if (!isGameElement(element)) return;
  if (e.ctrlKey) return;
  const newZoom = Math.max(camera.position.z + (e.deltaY > 0 ? 1 : -1), 1);
  if (newZoom === camera.position.z) return;
  setZoom(newZoom, true);
  if (zoomTimeout) clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(showZoomMessage, 250);
});

// Camera panning
let startPan: number | undefined;

addSystem({
  update: (scaledDelta, time) => {
    if (showSettingsVar() || document.activeElement !== document.body) {
      return false;
    }
    // Undo speed multiplier scaling so camera moves at wall-clock speed
    const delta = scaledDelta / (getSpeedMultiplier() || 1);
    const map = getMap();

    const skipKeyboard = showCommandPaletteVar() === "open";

    // Handle middle-click panning using raycaster approach
    if (panGrabPixels) {
      const raycaster = new Raycaster();
      const plane = new Plane(new Vector3(0, 0, 1), 0);

      // Calculate previous world position
      const prevCameraSpace = new Vector2(
        (panGrabPixels.x / globalThis.innerWidth) * 2 - 1,
        -(panGrabPixels.y / globalThis.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(prevCameraSpace, camera);
      const prevWorld3 = new Vector3();
      raycaster.ray.intersectPlane(plane, prevWorld3);

      // Calculate current world position
      const currCameraSpace = new Vector2(
        (mouse.pixels.x / globalThis.innerWidth) * 2 - 1,
        -(mouse.pixels.y / globalThis.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(currCameraSpace, camera);
      const currWorld3 = new Vector3();
      raycaster.ray.intersectPlane(plane, currWorld3);

      // Calculate world movement delta
      const worldDeltaX = currWorld3.x - prevWorld3.x;
      const worldDeltaY = currWorld3.y - prevWorld3.y;

      // Move camera opposite to maintain cursor lock on world
      camera.position.x = Math.min(
        Math.max(map.bounds.min.x, camera.position.x - worldDeltaX),
        map.bounds.max.x,
      );
      camera.position.y = Math.min(
        Math.max(map.bounds.min.y, camera.position.y - worldDeltaY),
        map.bounds.max.y,
      );

      // Update grab position for next frame
      panGrabPixels = { x: mouse.pixels.x, y: mouse.pixels.y };

      // Skip arrow/edge panning
      updateCursor();
      return;
    }

    let x = (keyboard.ArrowLeft && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowRight && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.x <= 12 ? -2 : 0) +
          (globalThis.innerWidth - mouse.pixels.x <= 12 ? 2 : 0)
        : 0);
    let y = (keyboard.ArrowDown && !skipKeyboard ? -1 : 0) +
      (keyboard.ArrowUp && !skipKeyboard ? 1 : 0) +
      (document.pointerLockElement
        ? (mouse.pixels.y <= 12 ? 2 : 0) +
          (globalThis.innerHeight - mouse.pixels.y <= 12 ? -2 : 0)
        : 0);

    const panDuration = typeof startPan === "number" ? (time - startPan) : 0;

    const panSpeed = gameplaySettingsVar().panSpeed;
    if (x) {
      x *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.x = Math.min(
        Math.max(
          map.bounds.min.x,
          camera.position.x + x * delta * camera.position.z * panSpeed,
        ),
        map.bounds.max.x,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(
          map.bounds.min.y,
          camera.position.y + y * delta * camera.position.z * panSpeed,
        ),
        map.bounds.max.y,
      );
    }

    if ((x || y) && typeof startPan !== "number") {
      startPan = time;
    } else if (!x && !y && typeof startPan === "number") {
      startPan = undefined;
    }

    updateCursor();
  },
});

// Pointer lock
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) cancelBlueprint();
});

for (const event of ["pointerdown", "keydown", "contextmenu"]) {
  globalThis.document.body.addEventListener(event, async () => {
    if (
      !document.pointerLockElement && !isSoftwareRenderer() &&
      gameplaySettingsVar().pointerLock === "always"
    ) {
      try {
        // Ensure body has focus before requesting pointer lock
        // This fixes scrolling issues when entering via keyboard
        if (event === "keydown" && document.activeElement !== document.body) {
          document.body.focus();
        }

        await globalThis.document.body.requestPointerLock({
          unadjustedMovement: gameplaySettingsVar().rawMouseInput,
        });
      } catch { /* do nothing */ }
    }
  });
}

const shortcutOverrides = (e: SystemEntity<"prefab" | "actions">) => {
  const shortcuts = shortcutsVar()[e.prefab];
  if (!shortcuts) return e;
  let overridden = false;

  const overrideAction = (
    action: UnitDataAction,
    menuContext?: string,
  ): UnitDataAction => {
    const shortcutKey = actionToShortcutKey(action, menuContext);
    const binding = shortcuts[shortcutKey];

    let updatedAction = action;

    if (
      binding && (
        !action.binding ||
        action.binding.length !== binding.length ||
        !action.binding.every((v, i) => v === binding[i])
      )
    ) {
      overridden = true;
      updatedAction = { ...action, binding };
    }

    if (updatedAction.type === "menu") {
      const menuName = actionToShortcutKey(updatedAction);
      const menuAction = updatedAction as UnitDataAction & { type: "menu" };
      const updatedSubActions = menuAction.actions.map((subAction) =>
        overrideAction(subAction, menuName)
      );

      if (
        updatedSubActions.some((newSub, i) => newSub !== menuAction.actions[i])
      ) {
        overridden = true;
        updatedAction = { ...menuAction, actions: updatedSubActions };
      }
    }

    return updatedAction;
  };

  const newActions = e.actions.map((action) => overrideAction(action));
  if (!overridden) return;
  e.actions = newActions;
};

const entities = new Set<SystemEntity<"prefab" | "actions">>();
addSystem({
  entities,
  props: ["prefab", "actions"],
  onAdd: shortcutOverrides,
  onChange: shortcutOverrides,
});

shortcutsVar.subscribe(() => {
  for (const e of entities) shortcutOverrides(e);
});

// Re-request pointer lock when rawMouseInput changes; release when pointerLock set to "never"
let lastRawMouseInput = gameplaySettingsVar().rawMouseInput;
let lastPointerLock = gameplaySettingsVar().pointerLock;
gameplaySettingsVar.subscribe(async (settings) => {
  if (settings.pointerLock !== lastPointerLock) {
    lastPointerLock = settings.pointerLock;
    if (settings.pointerLock === "never" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  if (settings.rawMouseInput !== lastRawMouseInput) {
    lastRawMouseInput = settings.rawMouseInput;
    if (document.pointerLockElement) {
      document.exitPointerLock();
      try {
        await globalThis.document.body.requestPointerLock({
          unadjustedMovement: settings.rawMouseInput,
        });
      } catch { /* do nothing */ }
    }
  }
});
