import { mouse, MouseButtonEvent } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { getLocalPlayer, playersVar } from "@/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";
import { camera } from "./graphics/three.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { prefabs } from "@/shared/data.ts";
import { canBuild } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { playSound } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { stateVar } from "@/vars/state.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import {
  clearSelection,
  selectAllMirrors,
  selectAllUnitsOfType,
  selectEntity,
  selectPrimaryUnit,
} from "./api/selection.ts";
import { getEntitiesInRect } from "./systems/kd.ts";
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
  normalize,
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
import { center } from "@/shared/map.ts";

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

// Mouse event handlers
mouse.addEventListener("mouseButtonDown", (e) => {
  // Handle focus/blur for UI elements
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== e.element
  ) document.activeElement.blur();

  if (
    (e.element instanceof HTMLElement || e.element instanceof SVGElement) &&
    e.element.id !== "ui"
  ) {
    e.element.focus();
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
    return;
  }

  if (e.button === "right") {
    if (selection.size) {
      playOrderSound(e.world.x, e.world.y);
      handleSmartTarget(e);
    }
  } else if (e.button === "left") handleLeftClick(e);
});

const handleLeftClick = (e: MouseButtonEvent) => {
  const blueprint = getBlueprint();

  if (blueprint) handleBlueprintClick(e);
  else if (getActiveOrder()) {
    if (!handleTargetOrder(e)) playSound("ui", pick("error1"), { volume: 0.3 });
  } else if (e.intersects.size) {
    selectEntity(e.intersects.first()!, !addToSelection());
  } else dragStart = { x: e.world.x, y: e.world.y };
};

const handleBlueprintClick = (e: MouseButtonEvent) => {
  const blueprint = getBlueprint();
  if (!blueprint) return;

  const prefab = blueprint.prefab;
  const unit = getBuilderFromBlueprint();
  if (!unit) return;

  const x = normalize(
    e.world.x,
    (prefabs[prefab]?.tilemap?.width ?? 0) % 4 === 0,
  );
  const y = normalize(
    e.world.y,
    (prefabs[prefab]?.tilemap?.height ?? 0) % 4 === 0,
  );

  if (!canBuild(unit, prefab, x, y)) {
    return playSound("ui", pick("error1"), { volume: 0.3 });
  }

  if (!e.queue) cancelBlueprint();
  else queued.state = true;

  if (selection.size) {
    const source = selection.first()?.position;
    if (source) {
      playOrderSound(e.world.x, e.world.y);
    }
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
  checkShortcut(shortcutsVar().misc.addToSelectionModifier);

mouse.addEventListener("mouseButtonUp", (e) => {
  if (e.button === "left" && selectionEntity && dragStart) {
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
      // Cast to client Entity type to access client-specific properties
      const clientEntity = entity as Entity;
      if (clientEntity.selectable === false || clientEntity.isDoodad) continue;

      if (clientEntity.owner === localPlayerId) {
        if (isStructure(clientEntity)) controllableEntities.push(clientEntity);
        else ownUnits.push(clientEntity);
      } else if (localPlayerId && hasAllyActions(clientEntity)) {
        controllableEntities.push(clientEntity);
      } else {
        otherEntities.push(clientEntity);
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
      if (!addToSelection()) clearSelection();
      for (const unit of toSelect) selectEntity(unit, false);
    }

    // Clean up selection rectangle
    app.removeEntity(selectionEntity);
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
        selectionEntity = app.addEntity({
          id: "selection-rectangle",
          model: "square",
          position: { x: 0, y: 0 },
          modelScale: 1,
          aspectRatio: 1,
          alpha: 0.3,
          selectable: false,
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
  for (const el of hovers) {
    if (!e.elements.includes(el)) el?.classList.remove("hover");
  }
  for (const el of e.elements) {
    if (!hovers.includes(el)) el.classList.add("hover");
  }
  hovers = e.elements;

  updateCursor(true);
});

// Keyboard event handlers
globalThis.addEventListener("keydown", (e) => {
  handleKeyDown(e.code);

  if (showSettingsVar()) return false;

  const shortcuts = shortcutsVar();

  // Handle UI shortcuts
  if (handleUIShortcuts(e, shortcuts)) return false;

  // Skip if in chat or command palette
  if (shouldSkipGameShortcuts(e)) return false;

  // Handle action shortcuts
  const { units, action } = findActionForShortcut(e, shortcuts);

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
    return true;
  }

  if (
    checkShortcut(shortcuts.misc.selectMirrors, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    selectAllMirrors();
    return true;
  }

  if (
    checkShortcut(shortcuts.misc.selectFoxes, e.code) &&
    showChatBoxVar() !== "open" &&
    showCommandPaletteVar() === "closed" &&
    stateVar() === "playing"
  ) {
    e.preventDefault();
    selectAllUnitsOfType("fox");
    return true;
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
  const queue = checkShortcut(shortcutsVar().misc.queueModifier);

  if (!queue) cancelOrder();
  else queued.state = true;

  // Filter units by mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  const unitsTotal = units.length;
  units = units.filter((unit) => (unit.mana ?? 0) >= manaCost);

  if (units.length === 0 && unitsTotal) {
    playSound("ui", pick("error1"), { volume: 0.3 });
    return;
  }

  // Check gold for build/purchase
  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    if (goldCost > 0 && units.length > 0) {
      const owningPlayer = playersVar().find((p) => p.id === units[0].owner);
      const playerGold = owningPlayer?.entity?.gold ?? 0;

      if (playerGold < goldCost) {
        playSound("ui", pick("error1"), { volume: 0.3 });
        return;
      }
    }
  }

  switch (action.type) {
    case "auto":
      handleAutoAction(action, units, queue);
      break;
    case "build":
      createBlueprint(action.unitType, mouse.world.x, mouse.world.y);
      break;
    case "target":
      setActiveOrder(
        action.order,
        action.order === "attack" || action.order === "meteor"
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
      closeAllMenus();
      break;
    case "menu":
      playSound("ui", pick("click1", "click2", "click3", "click4"), {
        volume: 0.1,
      });
      openMenu(action, units[0].id);
      break;
    default:
      absurd(action);
  }
};

const handleAutoAction = (
  action: { order: string },
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

  send({
    type: "unitOrder",
    order: action.order,
    units: units.map((u) => u.id),
    queue,
  });
};

globalThis.addEventListener("keyup", (e) => {
  handleKeyUp(e.code);
  if (
    queued.state &&
    !checkShortcut(shortcutsVar().misc.queueModifier)
  ) cancelOrder();
});

globalThis.addEventListener("blur", clearKeyboard);

// Camera controls
globalThis.addEventListener("wheel", (e) => {
  if (
    document.elementFromPoint(mouse.pixels.x, mouse.pixels.y)?.id !== "ui"
  ) {
    return false;
  }
  if (e.ctrlKey) return;
  camera.position.z += e.deltaY > 0 ? 1 : -1;
});

// Camera panning
let startPan: number | undefined;

app.addSystem({
  update: (delta, time) => {
    if (showSettingsVar() || document.activeElement !== document.body) {
      return false;
    }

    const skipKeyboard = showCommandPaletteVar() === "open";

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
        Math.max(0, camera.position.x + x * delta * 10),
        center.x * 2,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(0, camera.position.y + y * delta * 10),
        center.y * 2,
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
    if (!document.pointerLockElement) {
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

// Shortcut overrides system
import { SystemEntity } from "./ecs.ts";
import { actionToShortcutKey } from "./util/actionToShortcutKey.ts";
import { isStructure } from "@/shared/api/unit.ts";

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

const unitsWithActions = app.addSystem({
  props: ["prefab", "actions"],
  onAdd: shortcutOverrides,
  onChange: shortcutOverrides,
});

shortcutsVar.subscribe(() => {
  for (const e of unitsWithActions.entities) shortcutOverrides(e);
});
