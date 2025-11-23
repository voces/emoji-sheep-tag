import { DEFAULT_FACING, MIRROR_SEPARATION } from "@/shared/constants.ts";
import { Entity, Order, SystemEntity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { pathingMap, updatePathing } from "../systems/pathing.ts";
import { lookup } from "../systems/lookup.ts";
import { findActionByOrder } from "../util/actionLookup.ts";
import { removeEntity } from "@/shared/api/entity.ts";
import { appContext } from "@/shared/context.ts";

export const mirrorImageOrder = {
  id: "mirrorImage",

  onIssue: (unit, _, queue) => {
    if (!unit.position) return "failed";

    const action = findActionByOrder(unit, "mirrorImage");
    const castDuration =
      (action?.type === "auto" ? action.castDuration : undefined) ?? 1;

    const order: Order = {
      type: "cast",
      orderId: "mirrorImage",
      remaining: castDuration,
    };

    if (queue) {
      unit.queue = [...unit.queue ?? [], order];
      return "ordered";
    }

    delete unit.queue;
    unit.order = order;

    return "ordered";
  },

  onCastStart: (unit) => {
    // Clear existing mirrors
    if (unit.mirrors) {
      for (const mirrorId of unit.mirrors) {
        const mirror = lookup(mirrorId);
        if (mirror) removeEntity(mirror);
      }
      delete unit.mirrors;
    }
  },

  onCastComplete: (unit) => {
    if (
      unit.order?.type !== "cast" || unit.order.orderId !== "mirrorImage" ||
      !unit.position || !unit.prefab || !unit.owner || !unit.radius
    ) return;

    // Calculate mirror positions
    const angle1 = (unit.facing ?? DEFAULT_FACING) + Math.PI / 2;
    const angle2 = (unit.facing ?? DEFAULT_FACING) - Math.PI / 2;
    const p = pathingMap();
    const layer = p.layer(unit.position.x, unit.position.y);
    const pos1Pre = p.nearestSpiralPathing(
      unit.position.x + Math.cos(angle1) * MIRROR_SEPARATION,
      unit.position.y + Math.sin(angle1) * MIRROR_SEPARATION,
      unit as SystemEntity<"position" | "radius">,
    );
    const pos1 = p.nearestSpiralPathing(
      pos1Pre.x,
      pos1Pre.y,
      unit as SystemEntity<"position" | "radius">,
      layer,
    );
    const pos2Pre = p.nearestSpiralPathing(
      unit.position.x + Math.cos(angle2) * MIRROR_SEPARATION,
      unit.position.y + Math.sin(angle2) * MIRROR_SEPARATION,
      unit as SystemEntity<"position" | "radius">,
    );
    const pos2 = p.nearestSpiralPathing(
      pos2Pre.x,
      pos2Pre.y,
      unit as SystemEntity<"position" | "radius">,
      layer,
    );

    // Always relocate the caster to first position
    unit.position = pos1;
    updatePathing(unit);

    // Ensure real is updated
    appContext.current.enqueue(() => {
      if (!unit.owner || !unit.prefab) return;

      unit.buffs = null;

      const mirror: Entity = newUnit(unit.owner, unit.prefab, pos2.x, pos2.y);

      // Whitelist only specific actions for mirrors
      mirror.actions = mirror.actions?.filter((a) =>
        (a.type === "target" && ["move", "attack"].includes(a.order)) ||
        (a.type === "auto" && ["stop", "hold"].includes(a.order))
      );
      mirror.isMirror = true;
      if (unit.facing !== undefined) mirror.facing = unit.facing;
      if (unit.health !== undefined) mirror.health = unit.health;
      if (unit.mana !== undefined) mirror.mana = unit.mana;
      if (unit.inventory) mirror.inventory = [...unit.inventory];
      if (unit.trueOwner !== undefined) mirror.trueOwner = unit.trueOwner;

      // Randomize positions
      if (Math.random() < 0.5) {
        // Place them in outer space so they don't block each other
        const swap1 = unit.position;
        unit.position = { x: -Infinity, y: -Infinity };
        const swap2 = mirror.position;
        mirror.position = { x: -Infinity, y: -Infinity };

        // Make sure pathing map is clear
        appContext.current.enqueue(() => {
          // Swap them
          unit.position = swap2;
          updatePathing(unit);
          mirror.position = swap1;
          updatePathing(mirror);
        });
      }

      // Get lifetime duration from the action definition
      const action = findActionByOrder(unit, "mirrorImage");
      const lifetime = action?.type === "auto"
        ? action.buffDuration
        : undefined;
      if (lifetime) {
        mirror.buffs = [{
          remainingDuration: lifetime,
          totalDuration: lifetime,
          expiration: "MirrorImage",
        }];
      }

      unit.mirrors = [mirror.id];
    });
  },
} satisfies OrderDefinition;
