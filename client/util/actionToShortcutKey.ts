import { Entity } from "../ecs.ts";

export const actionToShortcutKey = (
  action: NonNullable<Entity["actions"]>[number],
) => action.type === "build" ? `build-${action.unitType}` : action.order;
