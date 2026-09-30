import { Entity } from "../ecs.ts";
import { mouse } from "../mouse.ts";
import { selection } from "../systems/selection.ts";
import { jumpToNextPing } from "../systems/indicators.ts";
import { isTauri } from "../isTauri.ts";
import { toggleFullscreen } from "../displayMode.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";
import { uiSettingsVar } from "@/vars/uiSettings.ts";
import { showCommandPaletteVar } from "@/vars/showCommandPalette.ts";
import { stateVar } from "@/vars/state.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { showSettingsVar } from "@/vars/showSettings.ts";
import { scoreboardExpandedVar } from "@/vars/scoreboard.ts";
import { selectionFocusVar } from "@/vars/selectionFocus.ts";
import { handleControlGroupKey } from "../api/controlGroups.ts";
import { applyZoom } from "../api/player.ts";
import { getCurrentMenu } from "@/vars/menuState.ts";
import {
  cancelBlueprint,
  createBlueprint,
  hasBlueprint,
} from "./blueprintHandlers.ts";
import { getActiveOrder, queued } from "./orderHandlers.ts";
import {
  checkShortcut,
  clearKeyboard,
  findActionForShortcut,
  handleKeyDown,
  handleKeyUp,
} from "./keyboardHandlers.ts";
import {
  editorActiveActionVar,
  editorTerrainClipboardVar,
  editorTerrainSelectionVar,
  editorVar,
} from "@/vars/editor.ts";
import {
  clearTerrainSelection,
  copyTerrainSelection,
} from "../editor/selection.ts";
import { redo, undo, undoLastStep } from "../editor/commands.ts";
import { copySelectedDoodads, startPaste } from "../editor/clipboard.ts";
import { cancelOrder } from "./cancelOrder.ts";
import { handleAction } from "./actions.ts";
import { cancelEditorPickOrPaste } from "./editorMouse.ts";
import { startTerrainTool } from "../editor/terrainTools.ts";

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

// Keyboard event handlers
document.addEventListener("keydown", (e) => {
  handleKeyDown(e.code);

  // Fullscreen. In the browser, F11 is the browser's own (non-rebindable)
  // fullscreen key. In Tauri it's the customizable misc.toggleFullscreen
  // binding (defaults: F11 + Alt+Enter).
  if (
    isTauri
      ? checkShortcut(shortcutsVar().misc, "toggleFullscreen", e.code)
      : e.key === "F11"
  ) {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

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
      // Terrain paste: a hidden tile blueprint tracks the cursor so the
      // SelectionOverlay's stamp follows it
      if (editorTerrainClipboardVar()) startTerrainTool({ kind: "paste" });
      else startPaste();
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
      if (cancelEditorPickOrPaste()) return false;
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
      // Only consume the (overloaded) key when there is actually an order or
      // blueprint to cancel; otherwise fall through to the scoreboard toggle.
      const hadActiveOrder = !!getActiveOrder() || hasBlueprint();
      cancelOrder();
      if (hadActiveOrder) return false;
    }

    // Scoreboard toggle. The key is overloaded with the cancel/back family
    // (menu back, cancel-upgrade, cancel order); those are handled above and
    // via handleAction, so reaching here means nothing was cancelled or closed.
    if (
      checkShortcut(shortcuts.misc, "toggleScoreboard", e.code) &&
      !getCurrentMenu()
    ) {
      e.preventDefault();
      scoreboardExpandedVar(!scoreboardExpandedVar());
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
    stateVar() === "playing" &&
    !uiSettingsVar().disableMessaging
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

document.addEventListener("keyup", (e) => {
  handleKeyUp(e.code);
  if (
    queued.state &&
    !checkShortcut(shortcutsVar().misc, "queueModifier")
  ) cancelOrder();
});

// Indirect since clearKeyboard has not yet be initialized due to circular imports
globalThis.addEventListener("blur", () => clearKeyboard());
