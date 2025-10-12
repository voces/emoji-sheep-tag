import { Entity } from "@/shared/types.ts";
import { addSystem, appContext } from "@/shared/context.ts";

const fn = (e: Entity) => {
  if (!appContext.current.entities.has(e)) return;
  if (e.order || !e.queue) return;
  if (!e.queue.length) return delete e.queue;
  if (e.queue.length > 1) return [e.order, ...e.queue] = e.queue;
  e.order = e.queue[0];
  delete e.queue;
};

addSystem({ props: ["order"], onAdd: fn, onChange: fn, onRemove: fn });
addSystem({ props: ["queue"], onAdd: fn, onChange: fn, onRemove: fn });
