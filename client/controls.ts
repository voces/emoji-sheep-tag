import { mouse, MouseButtonEvent } from "./mouse.ts";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { send } from "./client.ts";
import { Entity } from "./ecs.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { selection } from "./systems/selection.ts";
import { camera, terrain } from "./graphics/three.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { canBuild } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { playSound } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
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
import { applyZoom, getLocalPlayer } from "./api/player.ts";
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
import { getMap } from "@/shared/map.ts";
import { SystemEntity } from "./ecs.ts";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import { isStructure } from "@/shared/api/unit.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { editorVar } from "@/vars/editor.ts";
import { pickDoodad } from "./ui/views/Game/Editor/DoodadsPanel.tsx";
import { pathingMap } from "./systems/pathing.ts";
import { tileDefs } from "@/shared/data.ts";
import { updatePathingForCliff } from "@/shared/pathing/updatePathingForCliff.ts";

// Re-export for external use
export { getActiveOrder, keyboard };
export const clearBlueprint = clearBlueprintHandler;
export const hasBlueprint = hasBlueprintHandler;
export const cancelOrder = (
  check?: (order: string | undefined, blueprint: string | undefined) => boolean,
) => {
  if (check && !check(getActiveOrder()?.order, getBlueprintPrefab())) return;
  cancelOrderHandler(check);
  cancelBlueprint();
};

// Selection drag state
let dragStart: { x: number; y: number } | null = null;
let selectionEntity: Entity | null = null;

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
    const isGameElement = e.element.id === "ui" || e.element.id === "minimap";
    if (!isGameElement) e.element.focus();
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
    if (!isGameElement) return;
  }

  if (e.button === "right") {
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
  const blueprint = getBlueprint();

  // Don't handle entity selection/deselection on minimap
  const isMinimapClick = e.element?.id === "minimap";

  if (blueprint) {
    handleBlueprintClick(e);
    lastClickedEntity = null;
    lastEntityClickTime = 0;
  } else if (getActiveOrder()) {
    if (!handleTargetOrder(e)) playSound("ui", pick("error1"), { volume: 0.3 });
    lastClickedEntity = null;
    lastEntityClickTime = 0;
  } else if (e.intersects.size && !isMinimapClick) {
    const clickedEntity = e.intersects.first()!;
    const now = performance.now();
    const additive = addToSelection();
    const isDoubleClick = clickedEntity === lastClickedEntity &&
      now - lastEntityClickTime <= DOUBLE_CLICK_THRESHOLD_MS;

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
      send({
        type: "editorCreateEntity",
        entity: {
          ...entity,
          position: {
            x: Math.round(position!.x * 1000) / 1000,
            y: Math.round(position!.y * 1000) / 1000,
          },
        },
      });
      pickDoodad(entity.prefab);
      return;
    }

    const x = blueprint.position!.x - 0.5;
    const y = blueprint.position!.y - 0.5;

    // Helper to update client pathing after cliff changes
    const updateClientPathingForCliff = (worldX: number, worldY: number) => {
      updatePathingForCliff(
        pathingMap,
        terrain.masks.groundTile,
        terrain.masks.cliff,
        worldX,
        worldY,
      );
    };

    if (blueprint.vertexColor === 0xff01ff) {
      const newHeight = terrain.getCliff(x, y) + 1;
      terrain.setCliff(x, y, newHeight);
      updateClientPathingForCliff(x, y);
      send({ type: "editorSetCliff", x, y, cliff: newHeight });
    } else if (blueprint.vertexColor === 0xff02ff) {
      const newHeight = terrain.getCliff(x, y) - 1;
      terrain.setCliff(x, y, newHeight);
      updateClientPathingForCliff(x, y);
      send({ type: "editorSetCliff", x, y, cliff: newHeight });
    } else if (blueprint.vertexColor === 0xff03ff) {
      terrain.setCliff(x, y, "r");
      updateClientPathingForCliff(x, y);
      send({ type: "editorSetCliff", x, y, cliff: "r" });
    } else {
      terrain.setGroundTile(
        x,
        y,
        tileDefs.findIndex((t) => t.color === blueprint.vertexColor),
      );
      send({ type: "editorSetPathing", x, y, pathing: blueprint.pathing! });
      pathingMap.setPathing(x, y, blueprint.pathing!);
    }

    return;
  }

  const prefab = blueprint.prefab;
  const unit = getBuilderFromBlueprint();
  if (!unit) return;

  const [x, y] = normalizeBuildPosition(e.world.x, e.world.y, prefab);

  if (!canBuild(unit, prefab, x, y)) {
    return playSound("ui", pick("error1"), { volume: 0.3 });
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
  else if (e.button === "left" && selectionEntity && dragStart) {
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

  if (showSettingsVar()) return false;

  const shortcuts = shortcutsVar();

  if (document.activeElement?.tagName === "INPUT") return false;

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
    return;
  }

  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    if (goldCost > 0 && units.length > 0) {
      const owningPlayer = getPlayer(units[0].owner);
      const playerGold = owningPlayer?.gold ?? 0;

      if (playerGold < goldCost) {
        playSound("ui", pick("error1"), { volume: 0.3 });
        return;
      }
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
  const elementId = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y)
    ?.id;
  if (elementId !== "ui" && elementId !== "minimap") {
    return false;
  }
  if (e.ctrlKey) return;
  camera.position.z = Math.max(camera.position.z + (e.deltaY > 0 ? 1 : -1), 1);
  if (zoomTimeout) clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(() => {
    const settings = gameplaySettingsVar();
    const labels = [];

    if (camera.position.z === settings.sheepZoom) labels.push("sheep");
    if (camera.position.z === settings.wolfZoom) labels.push("wolf");
    if (camera.position.z === settings.spiritZoom) labels.push("spirit");
    if (camera.position.z === 9) labels.push("default");

    const labelText = labels.length === 4
      ? ` (default)`
      : labels.length > 0
      ? ` (${labels.join(", ")})`
      : "";

    addChatMessage(`Zoom set to ${camera.position.z}${labelText}.`);
  }, 250);
});

// Camera panning
let startPan: number | undefined;

addSystem({
  update: (delta, time) => {
    if (showSettingsVar() || document.activeElement !== document.body) {
      return false;
    }
    const { width, height } = getMap();

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
        Math.max(0, camera.position.x - worldDeltaX),
        width,
      );
      camera.position.y = Math.min(
        Math.max(0, camera.position.y - worldDeltaY),
        height,
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
        Math.max(0, camera.position.x + x * delta * camera.position.z),
        width,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(0, camera.position.y + y * delta * camera.position.z),
        height,
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
          unadjustedMovement: true,
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
