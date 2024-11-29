import { App } from "jsr:@verit/ecs";
import { Entity } from "../../shared/types.ts";

export const addQueueSystem = (app: App<Entity>) =>
  app.addSystem({
    props: ["queue"],
    updateChild: (e) => {
      if (!e.queue.length) return delete (e as Entity).queue;
      if (!e.action) {
        if (e.queue.length > 1) {
          console.debug("popping action from queue", e.queue);
          [e.action, ...e.queue] = e.queue;
        } else {
          console.debug("popping action and clearing queue", e.queue[0]);
          e.action = e.queue[0];
          delete (e as Entity).queue;
        }
      }
    },
  });
