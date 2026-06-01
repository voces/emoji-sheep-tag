import { OrderOverride } from "./types.ts";
import { handleMove } from "../actions/move.ts";
import { handleAttack } from "../actions/attack.ts";

/**
 * Core control verbs. They don't use the cast lifecycle (no precast/cooldown/
 * onCastComplete), so each does its work in onIssue and returns "ordered" to
 * signal it handled the order itself.
 */

export const moveOrder = {
  onIssue: (unit, target, queue) => {
    handleMove(unit, target, queue);
    return "ordered";
  },
} satisfies OrderOverride;

export const attackOrder = {
  onIssue: (unit, target, queue) => {
    handleAttack(unit, target, queue, false);
    return "ordered";
  },
} satisfies OrderOverride;

export const attackGroundOrder = {
  onIssue: (unit, target, queue) => {
    handleAttack(unit, target, queue, true);
    return "ordered";
  },
} satisfies OrderOverride;

export const stopOrder = {
  onIssue: (unit, _target, queue) => {
    // Queuing a stop is a no-op
    if (!queue) {
      delete unit.queue;
      delete unit.order;
      if (unit.swing) delete unit.swing;
    }
    return "ordered";
  },
} satisfies OrderOverride;

export const holdOrder = {
  onIssue: (unit, _target, queue) => {
    if (queue) unit.queue = [...unit.queue ?? [], { type: "hold" }];
    else {
      delete unit.queue;
      if (unit.swing) delete unit.swing;
      unit.order = { type: "hold" };
    }
    return "ordered";
  },
} satisfies OrderOverride;
