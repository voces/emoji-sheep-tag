import { unitData } from "../../shared/data.ts";
import { PathingEntity } from "../../shared/pathing/types.ts";
import { Entity } from "../../shared/types.ts";
import { currentApp } from "../contexts.ts";
import { isPathingEntity, pathingMap } from "../systems/pathing.ts";

export const build = (builder: Entity, type: string, x: number, y: number) => {
  const app = currentApp();
  if (!isPathingEntity(builder)) return;

  const temp = tempUnit(builder.owner!, type, x, y);
  if (!isPathingEntity(temp)) return app.add(temp);

  const p = pathingMap();

  // Make building if pathable
  const pathable = p.withoutEntity(
    builder as PathingEntity,
    () => p.pathable(temp as PathingEntity),
  );
  if (!pathable) return;
  app.add(temp);

  // Relocate entity if position not valid
  if (p.pathable(builder as PathingEntity)) return;
  const nearest = p.withoutEntity(
    builder as PathingEntity,
    () =>
      p.nearestSpiralPathing(
        builder.position!.x,
        builder.position!.y,
        builder as PathingEntity,
      ),
  );
  builder.position = nearest;
};

export const tempUnit = (
  owner: string,
  type: string,
  x: number,
  y: number,
): Entity => ({
  id: "",
  unitType: type,
  owner,
  position: { x, y },
  ...unitData[type],
});

export const newUnit = (owner: string, type: string, x: number, y: number) =>
  currentApp().add(tempUnit(owner, type, x, y));
