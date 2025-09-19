import { addSystem } from "@/shared/context.ts";
import { Entity } from "@/shared/types.ts";

addSystem({
  props: ["lastAttacker"],
  updateEntity: (e) => {
    delete (e as Entity).lastAttacker;
  },
});
