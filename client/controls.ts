import { mouse, MouseButtonEvent } from "./mouse.ts";
import { send } from "./client.ts";
import { app } from "./ecs.ts";
import { Entity } from "./ecs.ts";
import { playersVar } from "@/vars/players.ts";
import { selection } from "./systems/autoSelect.ts";
import { camera } from "./graphics/three.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { prefabs } from "@/shared/data.ts";
import { canBuild } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { playSound } from "./api/sound.ts";
import { pick } from "./util/pick.ts";
import { showChatBoxVar } from "./ui/pages/Game/Chat.tsx";
import { showCommandPaletteVar } from "@/components/CommandPalette.tsx";
import { stateVar } from "@/vars/state.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import {
  selectAllMirrors,
  selectAllUnitsOfType,
  selectEntity,
  selectPrimaryUnit,
} from "./api/selection.ts";
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
import {
  cancelOrder as cancelOrderHandler,
  getActiveOrder,
  handleSmartTarget,
  handleTargetOrder,
  playOrderSound,
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

// Mouse event handlers
mouse.addEventListener("mouseButtonDown", (e) => {
  // Handle focus/blur for UI elements
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== e.element
  ) {
    document.activeElement.blur();
  }

  if (
    (e.element instanceof HTMLElement || e.element instanceof SVGElement) &&
    e.element.id !== "ui"
  ) {
    e.element.focus();
    if ("click" in e.element) {
      e.element.click();
    } else {
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
  } else if (e.button === "left") {
    handleLeftClick(e);
  }
});

const handleLeftClick = (e: MouseButtonEvent) => {
  const blueprint = getBlueprint();

  if (blueprint) {
    handleBlueprintClick(e);
  } else if (getActiveOrder()) {
    if (!handleTargetOrder(e)) {
      // If no target order was handled and there's an intersection, select it
      if (e.intersects.size) {
        selectEntity(e.intersects.first()!);
      }
    }
  } else if (e.intersects.size) {
    selectEntity(e.intersects.first()!);
  }
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

  if (!canBuild(unit, prefab, x, y)) return;

  cancelBlueprint();

  if (selection.size) {
    const source = selection.first()?.position;
    if (source) {
      playOrderSound(e.world.x, e.world.y);
    }
  }

  send({ type: "build", unit: unit.id, buildType: prefab, x, y });
};

// Mouse move handler
let hover: Element | null = null;
let hovers: Element[] = [];

mouse.addEventListener("mouseMove", (e) => {
  updateBlueprint(e.world.x, e.world.y);

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
  cancelOrder();

  // Filter units by mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  const unitsTotal = units.length;
  units = units.filter((unit) => (unit.mana ?? 0) >= manaCost);

  if (units.length === 0 && unitsTotal) {
    playSound(pick("click1", "click2", "click3", "click4"), { volume: 0.3 });
    return;
  }

  // Check gold for build/purchase
  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    if (goldCost > 0 && units.length > 0) {
      const owningPlayer = playersVar().find((p) => p.id === units[0].owner);
      const playerGold = owningPlayer?.entity?.gold ?? 0;

      if (playerGold < goldCost) {
        playSound(pick("click1", "click2", "click3", "click4"), {
          volume: 0.3,
        });
        return;
      }
    }
  }

  switch (action.type) {
    case "auto":
      handleAutoAction(action, units);
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
      playSound(pick("click1", "click2", "click3", "click4"), { volume: 0.3 });
      send({
        type: "purchase",
        unit: units[0].id,
        itemId: action.itemId,
      });
      closeAllMenus();
      break;
    case "menu":
      playSound(pick("click1", "click2", "click3", "click4"), { volume: 0.1 });
      openMenu(action, units[0].id);
      break;
    default:
      absurd(action);
  }
};

const handleAutoAction = (action: { order: string }, units: Entity[]) => {
  // Handle special "back" order for closing menus
  if (action.order === "back" && getCurrentMenu()) {
    playSound(pick("click1", "click2", "click3", "click4"), { volume: 0.1 });
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
  });
};

globalThis.addEventListener("keyup", (e) => handleKeyUp(e.code));
globalThis.addEventListener("blur", clearKeyboard);

// Camera controls
globalThis.addEventListener("wheel", (e) => {
  if (
    document.elementFromPoint(mouse.pixels.x, mouse.pixels.y)?.id !== "ui"
  ) {
    return false;
  }
  camera.position.z += e.deltaY > 0 ? 1 : -1;
});

// Camera panning
let startPan: number | undefined;

app.addSystem({
  update: (delta, time) => {
    if (showSettingsVar()) return false;

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
        prefabs.map?.tilemap?.width ?? 100,
      );
    }
    if (y) {
      y *= 1 + 1.3 * Math.exp(-10 * panDuration) + (panDuration / 5) ** 0.5 -
        0.32;
      camera.position.y = Math.min(
        Math.max(0, camera.position.y + y * delta * 10),
        prefabs.map?.tilemap?.height ?? 100,
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
