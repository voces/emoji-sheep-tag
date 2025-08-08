import { Entity } from "@/shared/types.ts";

export const handleHold = (unit: Entity) => {
  delete unit.order;
  unit.order = { type: "hold" };
};
