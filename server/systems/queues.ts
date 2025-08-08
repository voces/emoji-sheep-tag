import { Entity } from "@/shared/types.ts";
import { addSystem } from "../ecs.ts";

addSystem({
  props: ["queue"],
  updateEntity: (e) => {
    if (!e.queue.length) return delete (e as Entity).queue;
    if (!e.order) {
      if (e.queue.length > 1) [e.order, ...e.queue] = e.queue;
      else {
        e.order = e.queue[0];
        delete (e as Entity).queue;
      }
    }
  },
});
