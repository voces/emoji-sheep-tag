import { prefabs } from "../data.ts";
import { Entity } from "../types.ts";

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
  extra?: Partial<Entity>,
): Entity => ({
  id: "",
  prefab: type,
  owner,
  position: { x, y },
  facing: Math.PI,
  ...(typeof prefabs[type]?.maxHealth === "number"
    ? { health: prefabs[type]?.maxHealth }
    : undefined),
  ...prefabs[type],
  ...extra,
});
