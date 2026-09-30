import { send } from "../messaging.ts";
import { Entity } from "../ecs.ts";
import i18next from "i18next";
import { mouse } from "../mouse.ts";
import { getEffectivePlayerGold, getLocalPlayer } from "../api/player.ts";
import { UnitDataAction } from "@/shared/types.ts";
import { absurd } from "@/shared/util/absurd.ts";
import { findAutoTarget } from "@/shared/util/autoTargeting.ts";
import { playSound } from "../api/sound.ts";
import { pick } from "../util/pick.ts";
import { showFeedback } from "@/vars/feedback.ts";
import { shortcutsVar } from "@/vars/shortcuts.ts";
import { selectPrimaryUnit } from "../api/selection.ts";
import {
  closeAllMenus,
  closeMenu,
  getCurrentMenu,
  openMenu,
} from "@/vars/menuState.ts";
import { createBlueprint } from "./blueprintHandlers.ts";
import { playOrderSound, queued, setActiveOrder } from "./orderHandlers.ts";
import { checkShortcut } from "./keyboardHandlers.ts";
import { cancelOrder } from "./cancelOrder.ts";
import { editorVar } from "@/vars/editor.ts";
import {
  batchCommand,
  deleteEntityCommand,
  type EditorCommand,
  executeCommand,
  keyboardMoveCommand,
} from "../editor/commands.ts";

export const handleAction = (action: UnitDataAction, units: Entity[]) => {
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
