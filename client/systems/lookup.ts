import { app, Entity } from "../ecs.ts";

// A system to track a reverse map for entity ids to entities
export const lookup: Record<string, Entity | undefined> = {};
app.addSystem({
  props: ["id"],
  onAdd: (e) => {
    lookup[e.id] = e;
  },
  onRemove: (e) => {
    delete lookup[e.id];
  },
});
