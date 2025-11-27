import { addSystem } from "@/shared/context.ts";
import { Entity } from "@/shared/types.ts";

addSystem({
  props: ["lastAttacker"],
  updateEntity: (e) => {
    if (typeof e.health === "number" && e.health > 0) {
      delete (e as Entity).lastAttacker;
    }
  },
});
