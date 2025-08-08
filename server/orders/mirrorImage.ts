import { DEFAULT_FACING, MIRROR_SEPARATION } from "@/shared/constants.ts";
import { Entity } from "@/shared/types.ts";
import { OrderDefinition } from "./types.ts";
import { newUnit } from "../api/unit.ts";
import { updatePathing } from "../systems/pathing.ts";
import { lookup } from "../systems/lookup.ts";
import { currentApp } from "../contexts.ts";

export const mirrorImageOrder = {
  id: "mirrorImage",

  // The action data that goes on prefabs
  action: {
    type: "auto" as const,
    order: "mirrorImage" as const,
    name: "Mirror Image",
    binding: ["KeyR"],
    castDuration: 1,
    manaCost: 20,
  },

  // Check if the unit can execute this order
  canExecute: (unit: Entity) => {
    // Must have position for positioning calculations
    return !!unit.position;
  },

  // Called when the order is initiated (sets up the order on the unit)
  initiate: (unit: Entity) => {
    if (!unit.position) return;

    // Calculate mirror positions
    const angle1 = (unit.facing ?? DEFAULT_FACING) + Math.PI / 2;
    const angle2 = (unit.facing ?? DEFAULT_FACING) - Math.PI / 2;
    let pos1 = {
      x: unit.position.x + Math.cos(angle1) * MIRROR_SEPARATION,
      y: unit.position.y + Math.sin(angle1) * MIRROR_SEPARATION,
    };
    let pos2 = {
      x: unit.position.x + Math.cos(angle2) * MIRROR_SEPARATION,
      y: unit.position.y + Math.sin(angle2) * MIRROR_SEPARATION,
    };

    // Randomize positions
    if (Math.random() < 0.5) [pos1, pos2] = [pos2, pos1];

    // Set the cast order
    unit.order = {
      type: "cast",
      orderId: "mirrorImage",
      remaining: mirrorImageOrder.action.castDuration ?? 0,
      positions: [pos1, pos2],
    };
    delete unit.queue;
  },

  // Called when the cast starts (order-specific side effects like clearing old state)
  onCastStart: (unit: Entity) => {
    // Clear existing mirrors
    if (unit.mirrors) {
      for (const mirrorId of unit.mirrors) {
        const mirror = lookup(mirrorId);
        if (mirror) {
          currentApp().delete(mirror);
        }
      }
      delete unit.mirrors;
    }
  },

  // Called when the cast completes (spawn units, create effects, etc)
  onCastComplete: (unit: Entity) => {
    if (unit.order?.type !== "cast" || unit.order.orderId !== "mirrorImage") {
      return;
    }

    // Always relocate the caster to first position (or stay in place if no positions)
    if (unit.order.positions && unit.order.positions.length > 0) {
      unit.position = unit.order.positions[0];
      updatePathing(unit);
    }

    // Create mirrors only if positions are provided (skip first position as that's the caster)
    if (
      unit.prefab && unit.owner && unit.order.positions &&
      unit.order.positions.length > 1
    ) {
      const mirrors: string[] = [];
      for (const pos of unit.order.positions.slice(1)) {
        const mirror = newUnit(unit.owner, unit.prefab, pos.x, pos.y);

        // Whitelist only specific actions for mirrors
        mirror.actions = mirror.actions.filter((a) =>
          (a.type === "target" && ["move", "attack"].includes(a.order)) ||
          (a.type === "auto" && ["stop", "hold"].includes(a.order))
        );

        updatePathing(mirror);
        mirror.isMirror = true;

        // Copy health and mana from original unit
        if (unit.health !== undefined) mirror.health = unit.health;
        if (unit.mana !== undefined) mirror.mana = unit.mana;

        mirrors.push(mirror.id);
      }
      unit.mirrors = mirrors;
    }
  },
} satisfies OrderDefinition;
