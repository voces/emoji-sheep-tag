import { SystemEntity } from "@/shared/types.ts";
import { acquireTarget } from "../api/unit.ts";
import { addSystem } from "@/shared/context.ts";

addSystem(() => {
  const idleCheck = (e: SystemEntity<"attack" | "position">) => {
    if (e.order || e.queue?.length || typeof e.progress === "number") return;

    const target = acquireTarget(e);
    if (target) e.order = { type: "attackMove", target: e.position };
  };

  const entities = new Set<SystemEntity<"attack" | "position">>();
  let counter = 0;

  return {
    props: ["attack", "position"],
    entities,
    update: () => {
      let offset = -1;
      for (const e of entities) {
        offset++;
        if ((counter + offset) % 11) continue;
        idleCheck(e);
      }
      counter++;
    },
  };
});
