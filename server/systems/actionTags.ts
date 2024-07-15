import { App } from "https://jsr.io/@verit/ecs/0.6.1/src/App.ts";
import { Entity } from "../ecs.ts";

export const addActionTagSystem = (app: App<Entity>) =>
  app.addSystem({
    props: ["action"],
    onAdd: (e) => {
      if (e.action.type === "walk" && !e.moving) e.moving = true;
    },
    onChange: (e) => {
      console.log("tag before", e);
      if (e.action.type === "walk" && !e.moving) e.moving = true;
      console.log("tag after", e);
    },
  });
