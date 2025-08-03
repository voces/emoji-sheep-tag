import { Entity } from "../../shared/types.ts";
import { addSystem } from "../ecs.ts";

addSystem({
  props: ["queue"],
  updateEntity: (e) => {
    if (!e.queue.length) return delete (e as Entity).queue;
    if (!e.action) {
      if (e.queue.length > 1) [e.action, ...e.queue] = e.queue;
      else {
        e.action = e.queue[0];
        delete (e as Entity).queue;
      }
    }
  },
});
