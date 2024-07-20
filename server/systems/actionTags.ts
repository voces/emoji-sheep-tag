import { App } from "https://jsr.io/@verit/ecs/0.6.1/src/App.ts";
import { Entity } from "../../shared/types.ts";
import { SystemEntity } from "jsr:@verit/ecs";
import { build } from "../api/unit.ts";

export const addActionTagSystem = (app: App<Entity>) => {
  const handler = (e: SystemEntity<Entity, "action">) => {
    if (e.action.type === "walk" && !e.moving) return e.moving = true;

    if (e.action.type === "build") {
      build(e, e.action.unitType, e.action.x, e.action.y);
      (e as Entity).action = null;
      return;
    }
    // if (e.action.type === "build")
  };

  app.addSystem({
    props: ["action"],
    onAdd: handler,
    onChange: handler,
  });
};
