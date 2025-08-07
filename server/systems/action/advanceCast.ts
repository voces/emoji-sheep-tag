import { DEFAULT_FACING } from "../../../shared/constants.ts";
import { Entity } from "../../../shared/types.ts";
import { newUnit } from "../../api/unit.ts";
import { updatePathing } from "../pathing.ts";
import { findLastPlayerUnit } from "../playerEntities.ts";
import { findActionByOrder } from "../../util/actionLookup.ts";
import { lookup } from "../lookup.ts";
import { currentApp } from "../../contexts.ts";

export const advanceCast = (e: Entity, delta: number) => {
  if (e.order?.type !== "cast") return delta;

  // Handle cast start side effects (only once when cast begins)
  if (!e.order.started) {
    switch (e.order.orderId) {
      case "mirrorImage": {
        // Clear existing mirrors
        if (e.mirrors) {
          for (const mirrorId of e.mirrors) {
            const mirror = lookup(mirrorId);
            if (mirror) {
              currentApp().delete(mirror);
            }
          }
          delete e.mirrors;
        }

        // Consume mana
        const mirrorImageAction = findActionByOrder(e, "mirrorImage");
        if (mirrorImageAction) {
          const manaCost = ("manaCost" in mirrorImageAction
            ? mirrorImageAction.manaCost
            : undefined) ?? 0;
          if (manaCost > 0 && e.mana) {
            e.mana -= manaCost;
          }
        }
        break;
      }
      case "fox": {
        // Consume mana
        const foxAction = findActionByOrder(e, "fox");
        if (foxAction) {
          const manaCost =
            ("manaCost" in foxAction ? foxAction.manaCost : undefined) ?? 0;
          if (manaCost > 0 && e.mana) {
            e.mana -= manaCost;
          }
        }
        break;
      }
        // destroyLastFarm doesn't have start side effects
    }

    // Mark the order as started
    e.order = { ...e.order, started: true };
  }

  if (delta < e.order.remaining) {
    e.order = { ...e.order, remaining: e.order.remaining - delta };
    return 0;
  }

  delta -= e.order.remaining;

  switch (e.order.orderId) {
    case "mirrorImage":
      // Always relocate the caster to first position (or stay in place if no positions)
      if (e.order.positions && e.order.positions.length > 0) {
        e.position = e.order.positions[0];
        updatePathing(e);
      }

      // Create mirrors only if positions are provided (skip first position as that's the caster)
      if (
        e.prefab && e.owner && e.order.positions && e.order.positions.length > 1
      ) {
        const mirrors: string[] = [];
        for (const pos of e.order.positions.slice(1)) {
          const mirror = newUnit(e.owner, e.prefab, pos.x, pos.y);
          mirror.actions = mirror.actions.filter((a) =>
            (a.type === "target" && ["move", "attack"].includes(a.order)) ||
            (a.type === "auto" && ["stop", "hold"].includes(a.order))
          );
          updatePathing(mirror);
          mirror.isMirror = true;

          // Copy health and mana from original unit
          if (e.health !== undefined) mirror.health = e.health;
          if (e.mana !== undefined) mirror.mana = e.mana;

          mirrors.push(mirror.id);
        }
        e.mirrors = mirrors;
      }
      break;
    case "fox": {
      if (e.owner && e.position) {
        const angle = e.facing ?? DEFAULT_FACING;
        const x = e.position.x + Math.cos(angle);
        const y = e.position.y + Math.sin(angle);
        newUnit(e.owner, "fox", x, y);
      }
      break;
    }
    case "destroyLastFarm": {
      if (e.owner) {
        const lastFarm = findLastPlayerUnit(
          e.owner,
          (entity) => !!entity.tilemap,
        );
        if (lastFarm) lastFarm.health = 0;
      }
      break;
    }
    default:
      console.warn(`Unhandled cast order ${e.order.orderId}`);
  }

  delete e.order;

  return delta;
};
