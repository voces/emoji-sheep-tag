import { Entity } from "../../shared/types.ts";

export const handleHold = (unit: Entity) => {
  delete unit.queue;
  unit.action = { type: "hold" };
};
