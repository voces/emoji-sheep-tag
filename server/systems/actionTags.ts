import { App, SystemEntity } from "jsr:@verit/ecs";

import { Entity } from "../../shared/types.ts";

export const addActionTagSystem = (app: App<Entity>) => {
  const handler = (e: SystemEntity<Entity, "action">) => {
    if (e.isIdle) delete e.isIdle;

    if (e.action.type === "walk") return e.isMoving = true;

    if (e.action.type === "build") return e.isBuilding = true;

    if (e.action.type === "attack") return e.isAttacking = true;
  };

  app.addSystem({
    props: ["action"],
    onAdd: handler,
    onChange: handler,
    onRemove: (e) => {
      if (e.queue?.length) {
        if (e.queue.length > 1) [e.action, ...e.queue] = e.queue;
        else {
          const next = e.queue[0];
          delete e.queue;
          e.action = next;
        }
      } else e.isIdle = true;
    },
  });
};
