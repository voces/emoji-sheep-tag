import { App, SystemEntity } from "jsr:@verit/ecs";

import { Entity } from "../../shared/types.ts";
import { build } from "../api/unit.ts";
import { distanceBetweenPoints } from "../../shared/pathing/math.ts";
import { BUILD_RADIUS } from "../../shared/data.ts";

export const addActionTagSystem = (app: App<Entity>) => {
  const handler = (e: SystemEntity<Entity, "action">) => {
    if (e.action.type === "walk" && !e.moving) return e.moving = true;

    if (e.action.type === "build") {
      if (
        e.position &&
        distanceBetweenPoints(e.position, e.action) > BUILD_RADIUS
      ) return (e as Entity).action = null;

      build(e, e.action.unitType, e.action.x, e.action.y);
      return (e as Entity).action = null;
    }
  };

  app.addSystem({
    props: ["action"],
    onAdd: handler,
    onChange: handler,
  });
};
