import { mouse, MouseButtonEvent } from "./mouse.ts";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { send } from "./client.ts";
import { Entity } from "./ecs.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { selection } from "./systems/selection.ts";
import { jumpToNextPing } from "./systems/indicators.ts";
import { camera, terrain } from "./graphics/three.ts";
import { getEffectivePlayerGold } from "./api/player.ts";
import { UnitDataAction, UnitDataActionTarget } from "@/shared/types.ts";
import { formatTargeting } from "@/shared/util/formatTargeting.ts";
import { findAction } from "@/shared/util/actionLookup.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { canBuild } from "./api/unit.ts";
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
import {
  clearSelection,
  DOUBLE_CLICK_SELECTION_RADIUS,
  selectAllFoxes,
  selectAllMirrors,
  selectEntitiesByPrefabInRadius,
  selectEntity,
  selectPrimaryUnit,
} from "./api/selection.ts";
import {
  applyZoom,
  getLocalPlayer,
  setZoom,
  showZoomMessage,
} from "./api/player.ts";
import { getEntitiesInRect } from "@/shared/systems/kd.ts";
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
import { hasAllyActions } from "./util/allyPermissions.ts";
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
import { getCliffs, getMap, getTiles } from "@/shared/map.ts";
import { updatePathingForCliff } from "@/shared/pathing/updatePathingForCliff.ts";
import { SystemEntity } from "./ecs.ts";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { editorVar } from "@/vars/editor.ts";
import { pickDoodad } from "./ui/views/Game/Editor/DoodadsPanel.tsx";
import { tileDefs } from "@/shared/data.ts";
import { pathingMap } from "./systems/pathing.ts";
import {
  batchCommand,
  createEntityCommand,
  deleteEntityCommand,
  type EditorCommand,
  executeCommand,
  keyboardMoveCommand,
  moveEntitiesCommand,
  recordCommand,
  redo,
  setCliffCommand,
  setPathingCommand,
  undo,
} from "./editor/commands.ts";
import {
  cancelPaste,
  confirmPaste,
  copySelectedDoodads,
  isPasting,
  startPaste,
  updatePasteBlueprints,
} from "./editor/clipboard.ts";

// Re-export for external use
export { getActiveOrder, keyboard };
export const clearBlueprint = clearBlueprintHandler;
export const hasBlueprint = hasBlueprintHandler;

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

// Selection drag state
let dragStart: { x: number; y: number } | null = null;
let selectionEntity: Entity | null = null;

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

// Middle-click camera panning state
let panGrabPixels: { x: number; y: number } | null = null;

const DOUBLE_CLICK_THRESHOLD_MS = 300;
let lastEntityClickTime = 0;
let lastClickedEntity: Entity | null = null;

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
    if ("click" in e.element) e.element.click();
    else {
      e.element.dispatchEvent(
        new MouseEvent("click", {
          view: window,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    if (!passThrough) return;
  }

  if (e.button === "right") {
    // Cancel paste on right click
    if (editorVar() && isPasting()) {
      cancelPaste();
      return;
    }
    if (gameplaySettingsVar().clearOrderOnRightClick) cancelOrder();
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
    lastClickedEntity = null;
    lastEntityClickTime = 0;
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
    lastClickedEntity = null;
    lastEntityClickTime = 0;
  } else if (e.intersects.size && !isMinimapClick) {
    const clickedEntity = e.intersects.first()!;
    const now = performance.now();
    const additive = addToSelection();
    const isDoubleClick = clickedEntity === lastClickedEntity &&
      now - lastEntityClickTime <= DOUBLE_CLICK_THRESHOLD_MS;

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
      lastEntityClickTime = now;
      lastClickedEntity = clickedEntity;
      return;
    }

    if (isDoubleClick) {
      selectEntitiesByPrefabInRadius(
        clickedEntity,
        DOUBLE_CLICK_SELECTION_RADIUS,
        additive,
        additive,
      );
    } else {
      selectEntity(clickedEntity, !additive, additive);
    }

    lastEntityClickTime = now;
    lastClickedEntity = clickedEntity;
  } else if (!isMinimapClick) {
    dragStart = { x: e.world.x, y: e.world.y };
    lastClickedEntity = null;
    lastEntityClickTime = 0;
  }
};

// Apply a tile or cliff change at the given position, returning the command if applied
const applyEditorTileChange = (
  blueprint: ReturnType<typeof getBlueprint>,
  worldX: number,
  worldY: number,
): EditorCommand | null => {
  if (!blueprint || blueprint.prefab !== "tile" || blueprint.owner) return null;

  const [normX, normY] = normalizeBuildPosition(worldX, worldY, "tile");
  const x = normX - 0.5;
  const y = normY - 0.5;
  const key = `${x},${y}`;

  // Skip if already visited in this drag
  if (editorTileDrag?.visited.has(key)) return null;
  editorTileDrag?.visited.add(key);

  if (blueprint.vertexColor === 0xff01ff) {
    // Raise cliff
    const oldHeight = terrain.getCliff(x, y);
    const newHeight = editorTileDrag?.targetCliff ?? oldHeight + 1;
    if (oldHeight === newHeight) return null;
    const command = setCliffCommand(x, y, oldHeight, newHeight);
    doExecuteCommand(command);
    return command;
  } else if (blueprint.vertexColor === 0xff02ff) {
    // Lower cliff
    const oldHeight = terrain.getCliff(x, y);
    const newHeight = editorTileDrag?.targetCliff ?? oldHeight - 1;
    if (oldHeight === newHeight) return null;
    const command = setCliffCommand(x, y, oldHeight, newHeight);
    doExecuteCommand(command);
    return command;
  } else if (blueprint.vertexColor === 0xff03ff) {
    // Ramp - toggle: if already a ramp, convert to interpolated height
    const oldHeight = terrain.getCliff(x, y);
    const cliffs = getCliffs();
    const mapY = cliffs.length - 1 - y;
    const currentCliff = cliffs[mapY]?.[x];
    if (currentCliff === "r") {
      // Remove ramp - convert to interpolated height
      const command = setCliffCommand(x, y, "r", oldHeight);
      doExecuteCommand(command);
      return command;
    }
    const command = setCliffCommand(x, y, oldHeight, "r");
    doExecuteCommand(command);
    return command;
  } else {
    // Regular tile
    const tileIndex = tileDefs.findIndex((t) =>
      t.color === blueprint.vertexColor
    );
    const oldTile = terrain.masks.groundTile[y]?.[x] ?? 0;
    if (oldTile === tileIndex) return null;
    const oldPathing = tileDefs[oldTile]?.pathing ?? 0;
    const command = setPathingCommand(
      x,
      y,
      oldPathing,
      blueprint.pathing!,
      oldTile,
      tileIndex,
    );
    doExecuteCommand(command);
    return command;
  }
};

// Execute command without adding to undo stack (for batching during drag)
const doExecuteCommand = (command: EditorCommand) => {
  switch (command.type) {
    case "setPathing": {
      terrain.setGroundTile(command.x, command.y, command.newTile);
      pathingMap.setPathing(command.x, command.y, command.newPathing);
      send({
        type: "editorSetPathing",
        x: command.x,
        y: command.y,
        pathing: command.newPathing,
        tile: command.newTile,
      });
      break;
    }
    case "setCliff":
      terrain.setCliff(command.x, command.y, command.newCliff);
      updatePathingForCliff(
        pathingMap,
        getTiles(),
        getCliffs(),
        command.x,
        command.y,
        getMap().bounds,
      );
      send({
        type: "editorSetCliff",
        x: command.x,
        y: command.y,
        cliff: command.newCliff,
      });
      break;
  }
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
    const { id: _, position, ...entity } = blueprint;
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

    // Calculate target cliff height for plateau behavior
    let targetCliff: number | "r" | undefined;
    if (blueprint.vertexColor === 0xff01ff) {
      targetCliff = terrain.getCliff(x, y) + 1;
    } else if (blueprint.vertexColor === 0xff02ff) {
      targetCliff = terrain.getCliff(x, y) - 1;
    } else if (blueprint.vertexColor === 0xff03ff) {
      targetCliff = "r";
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
    showFeedback("Cannot build here");
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

const addToSelection = () =>
  checkShortcut(shortcutsVar().misc.addToSelectionModifier) > 0;

mouse.addEventListener("mouseButtonUp", (e) => {
  if (e.button === "middle") panGrabPixels = null;
  else if (e.button === "left" && editorTileDrag) {
    // Finish editor tile/cliff drag - record all commands in undo stack (already executed)
    if (editorTileDrag.commands.length > 0) {
      recordCommand(
        editorTileDrag.commands.length === 1
          ? editorTileDrag.commands[0]
          : batchCommand(editorTileDrag.commands),
      );
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
    // Calculate selection bounds
    const minX = Math.min(dragStart.x, e.world.x);
    const maxX = Math.max(dragStart.x, e.world.x);
    const minY = Math.min(dragStart.y, e.world.y);
    const maxY = Math.max(dragStart.y, e.world.y);

    // Find all units within the selection rectangle using KDTree
    const entitiesInRect = getEntitiesInRect(minX, minY, maxX, maxY);
    const ownUnits: Entity[] = [];
    const controllableEntities: Entity[] = []; // Own structures + ally entities with actions
    const otherEntities: Entity[] = [];
    const localPlayerId = getLocalPlayer()?.id;

    for (const entity of entitiesInRect) {
      if (entity.isDoodad && !editorVar()) continue;
      if (entity.id === "selection-rectangle") continue;
      if (entity.isEffect) continue;
      // Skip entities hidden by fog
      if ((entity as Entity).hiddenByFog) continue;

      if (entity.owner === localPlayerId) {
        if (isStructure(entity)) controllableEntities.push(entity);
        else ownUnits.push(entity);
      } else if (localPlayerId && hasAllyActions(entity)) {
        controllableEntities.push(entity);
      } else {
        otherEntities.push(entity);
      }
    }

    const toSelect = ownUnits.length && ownUnits.some((e) => !e.selected)
      ? ownUnits
      : controllableEntities.length &&
          controllableEntities.some((e) => !e.selected)
      ? controllableEntities
      : otherEntities.length && otherEntities.some((e) => !e.selected)
      ? otherEntities
      : ownUnits.length
      ? ownUnits
      : controllableEntities.length
      ? controllableEntities
      : otherEntities;

    // Select all units within the rectangle
    if (toSelect.length > 0) {
      const toggle = addToSelection();
      if (!toggle) clearSelection();
      for (const unit of toSelect) selectEntity(unit, false, toggle);
    }

    // Clean up selection rectangle
    appContext.current.removeEntity(selectionEntity);
    selectionEntity = null;
  }
  dragStart = null;
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
    const currentX = e.world.x;
    const currentY = e.world.y;
    const deltaX = Math.abs(currentX - dragStart.x);
    const deltaY = Math.abs(currentY - dragStart.y);

    // Only create rectangle if dragged more than a small threshold
    if (deltaX > 0.01 || deltaY > 0.01 || selectionEntity) {
      if (!selectionEntity) {
        // Create the selection rectangle entity
        selectionEntity = appContext.current.addEntity({
          id: "selection-rectangle",
          model: "square",
          position: { x: 0, y: 0 },
          modelScale: 1,
          aspectRatio: 1,
          alpha: 0.3,
          isDoodad: true,
        });
      }

      // Update position and scale of the selection rectangle
      // Center the rectangle between drag start and current position
      const centerX = (dragStart.x + currentX) / 2;
      const centerY = (dragStart.y + currentY) / 2;

      // Calculate scale based on the drag distance
      const width = Math.abs(currentX - dragStart.x);
      const height = Math.abs(currentY - dragStart.y);

      // Update the entity
      selectionEntity.position = { x: centerX, y: centerY };
      // Fallbacks too large
      selectionEntity.modelScale = width || 0.01;
      selectionEntity.aspectRatio = height / (width || 0.01) || 0.01;
    }
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

  // Handle editor undo/redo (Ctrl+Z / Ctrl+Shift+Z)
  if (editorVar() && (e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return false;
  }

  // Handle editor copy/cut/paste (Ctrl+C / Ctrl+X / Ctrl+V)
  if (editorVar() && (e.ctrlKey || e.metaKey)) {
    if (e.code === "KeyC") {
      e.preventDefault();
      copySelectedDoodads(false);
      return false;
    }
    if (e.code === "KeyX") {
      e.preventDefault();
      copySelectedDoodads(true);
      return false;
    }
    if (e.code === "KeyV") {
      e.preventDefault();
      startPaste();
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
  if (checkShortcut(shortcuts.misc.ping, e.code)) {
    e.preventDefault();
    // Create ping blueprint at current mouse position
    createBlueprint("ping", mouse.world.x, mouse.world.y);
    return false;
  }

  if (!action) {
    // Handle cancel
    if (checkShortcut(shortcuts.misc.cancel, e.code)) {
      // Cancel paste mode if active
      if (editorVar() && isPasting()) {
        cancelPaste();
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
    checkShortcut(shortcuts.misc.openCommandPalette, e.code) &&
    showCommandPaletteVar() === "closed"
  ) {
    e.preventDefault();
    showCommandPaletteVar("open");
    return true;
  }

  // Chat
  if (
    checkShortcut(shortcuts.misc.openChat, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    showChatBoxVar("open");
    return true;
  }

  // Selection shortcuts
  if (
    checkShortcut(shortcuts.misc.selectOwnUnit, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    selectPrimaryUnit();
  }

  if (
    checkShortcut(shortcuts.misc.selectMirrors, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    selectAllMirrors();
  }

  if (
    checkShortcut(shortcuts.misc.selectFoxes, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    selectAllFoxes();
  }

  if (
    checkShortcut(shortcuts.misc.jumpToPing, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    if (jumpToNextPing()) e.preventDefault();
  }

  if (
    checkShortcut(shortcuts.misc.applyZoom, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
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
  const queue = checkShortcut(shortcutsVar().misc.queueModifier) > 0;

  if (!queue) cancelOrder();
  else queued.state = true;

  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  const unitsTotal = units.length;
  units = units.filter((unit) => (unit.mana ?? 0) >= manaCost);

  if (units.length === 0 && unitsTotal) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    showFeedback("Not enough mana");
    return;
  }

  if ("goldCost" in action && action.goldCost && units.length) {
    const playerGold = getEffectivePlayerGold(units[0].owner);
    if (playerGold < action.goldCost) {
      playSound("ui", pick("error1"), { volume: 0.3 });
      showFeedback("Not enough gold");
      return;
    }
  }

  units = units.filter((unit) => {
    const isConstructing = typeof unit.progress === "number";
    if (!isConstructing) return true;
    const canExecute = "canExecuteWhileConstructing" in action &&
      action.canExecuteWhileConstructing === true;
    return canExecute;
  });

  if (units.length === 0 && unitsTotal > 0) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    showFeedback("Unit is busy");
    return;
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
      break;
    case "target":
      setActiveOrder(
        action.order,
        action.order === "attack" || action.order === "attack-ground" ||
          action.order === "meteor"
          ? "enemy"
          : "ally",
        action.aoe ?? 0,
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

  if (units.length > 0 && units[0].position) {
    playOrderSound(units[0].position.x, units[0].position.y);
  } else {
    playOrderSound();
  }

  if (action.order === "illusify") selectPrimaryUnit();

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
    !checkShortcut(shortcutsVar().misc.queueModifier)
  ) cancelOrder();
});

globalThis.addEventListener("blur", clearKeyboard);

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
  update: (delta, time) => {
    if (showSettingsVar() || document.activeElement !== document.body) {
      return false;
    }
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

    if (x) {
      x *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.x = Math.min(
        Math.max(
          map.bounds.min.x,
          camera.position.x + x * delta * camera.position.z,
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
          camera.position.y + y * delta * camera.position.z,
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
    if (!document.pointerLockElement && !isSoftwareRenderer()) {
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

// Re-request pointer lock when rawMouseInput setting changes
let lastRawMouseInput = gameplaySettingsVar().rawMouseInput;
gameplaySettingsVar.subscribe(async (settings) => {
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
