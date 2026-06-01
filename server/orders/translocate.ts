import { SystemEntity } from "@/shared/types.ts";
import { OrderOverride } from "./types.ts";
import { lookup } from "../systems/lookup.ts";
import { translocateUnit } from "../api/unit.ts";

export const translocateOrder = {
  canExecute: (_unit, target) => typeof target === "string",

  onCastComplete: (unit) => {
    if (unit.order?.type !== "cast" || !unit.order.targetId) return;
    if (!unit.position) return;

    const target = lookup(unit.order.targetId);
    if (!target?.position || typeof target.radius !== "number") return;

    translocateUnit(
      target as SystemEntity<"position" | "radius">,
      unit.position,
      unit.id,
    );
  },
} satisfies OrderOverride;
