import { Entity } from "../ecs.ts";
import { addSystem } from "@/shared/context.ts";

// A system to track a reverse map for entity ids to entities
export const lookup: Record<string, Entity | undefined> = {};
addSystem({
  props: ["id"],
  onAdd: (e) => {
    lookup[e.id] = e;
  },
  onRemove: (e) => {
    delete lookup[e.id];
  },
});
