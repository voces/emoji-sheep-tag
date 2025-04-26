import { unitData } from "../data.ts";
import { Entity } from "../types.ts";

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
): Entity => ({
  id: "",
  unitType: type,
  owner,
  position: { x, y },
  facing: Math.PI,
  ...(typeof unitData[type]?.maxHealth === "number"
    ? { health: unitData[type]?.maxHealth }
    : undefined),
  isIdle: true,
  ...unitData[type],
  ...extra,
});
