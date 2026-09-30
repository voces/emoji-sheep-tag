import { mouse, MouseButtonEvent } from "./mouse.ts";
import { send } from "./messaging.ts";
import i18next from "i18next";
import { selection } from "./systems/selection.ts";
import { UnitDataActionTarget } from "@/shared/types.ts";
import { formatTargeting } from "@/shared/util/formatTargeting.ts";
import { findAction } from "@/shared/util/actionLookup.ts";
import { canBuild } from "./api/unit.ts";
import { updateCursor } from "./graphics/cursor.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import {
  cancelBlueprint,
  clearBlueprint as clearBlueprintHandler,
  getBlueprint,
  getBuilderFromBlueprint,
  hasBlueprint as hasBlueprintHandler,
  normalizeBuildPosition,
  updateBlueprint,
} from "./controls/blueprintHandlers.ts";
import {
  getActiveOrder,
  handleSmartTarget,
  handleTargetOrder,
  playOrderSound,
  queued,
  rejectAction,
} from "./controls/orderHandlers.ts";
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
import { editorVar } from "@/vars/editor.ts";
import "./editor/brushPreview.ts";
import { cancelOrder } from "./controls/cancelOrder.ts";
import {
  bridgeMouseDown,
  bridgeMouseMove,
  bridgeMouseUp,
} from "./controls/domEventBridge.ts";
import {
  cancelEditorPickOrPaste,
  handleEditorBlueprintClick,
  handleEditorLeftClick,
  handleEditorMouseMove,
  handleEditorMouseUp,
  tryStartEditorDoodadDrag,
} from "./controls/editorMouse.ts";
import "./controls/keydown.ts";
import { endPanGrab, startPanGrab } from "./controls/camera.ts";
import "./controls/pointerLock.ts";
import "./controls/shortcutOverrides.ts";

// Re-export for external use
export const clearBlueprint = clearBlueprintHandler;
export const hasBlueprint = hasBlueprintHandler;
export { cancelOrder };

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

// Set getters on mouse object for event state capture
mouse.getActiveOrder = getActiveOrder;
mouse.getBlueprint = getBlueprint;

// Mouse event handlers
mouse.addEventListener("mouseButtonDown", (e) => {
  if (bridgeMouseDown(e)) return;

  if (e.button === "right") {
    if (cancelEditorPickOrPaste()) return;
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
    startPanGrab(e.pixels.x, e.pixels.y);
  }
});

// A click that is not on an entity breaks any double-click sequence
const forgetLastClick = () => {
  setLastClickedEntity(null);
  setLastEntityClickTime(0);
};

const handleLeftClick = (e: MouseButtonEvent) => {
  if (handleEditorLeftClick(e)) return;

  const blueprint = getBlueprint();

  // Don't handle entity selection/deselection on minimap
  const isMinimapClick = e.element instanceof HTMLElement &&
    e.element.hasAttribute("data-minimap");

  if (blueprint) {
    handleBlueprintClick(e);
    forgetLastClick();
  } else if (getActiveOrder()) {
    const result = handleTargetOrder(e);
    if (!result.success) {
      rejectAction(
        result.reason === "out-of-range"
          ? "Target is out of range"
          : getTargetingMessage(getActiveOrder()!.order),
      );
    }
    forgetLastClick();
  } else if (e.intersects.size && !isMinimapClick) {
    const clickedEntity = e.intersects.first()!;
    const now = performance.now();

    if (tryStartEditorDoodadDrag(clickedEntity)) {
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
    forgetLastClick();
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
    handleEditorBlueprintClick(e, blueprint);
    return;
  }

  const prefab = blueprint.prefab;
  const unit = getBuilderFromBlueprint();
  if (!unit) return;

  const [x, y] = normalizeBuildPosition(e.world.x, e.world.y, prefab);

  if (!canBuild(unit, prefab, x, y)) {
    rejectAction(i18next.t("hud.cannotBuildThere"));
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
  bridgeMouseUp(e);

  if (e.button === "middle") endPanGrab();
  else if (e.button === "left" && !handleEditorMouseUp()) {
    if (selectionEntity && dragStart) {
      handleDragSelectionOnMouseUp(e.world.x, e.world.y);
    } else if (pendingEntityClick) {
      handleEntitySelectionOnMouseUp(e.pixels.x, e.pixels.y);
    }
  }
  cleanupSelectionState();
});

mouse.addEventListener("mouseMove", (e) => {
  updateBlueprint(e.world.x, e.world.y);

  handleEditorMouseMove(e);

  // Handle selection rectangle dragging
  if (dragStart && !getBlueprint() && !getActiveOrder()) {
    updateSelectionRectangle(e.world.x, e.world.y);
  }

  bridgeMouseMove(e);

  updateCursor(true);
});
