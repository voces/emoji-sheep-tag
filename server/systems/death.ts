import { onInit, UnitDeathEvent } from "../ecs.ts";
import { getDamageSource } from "./attack.ts";

onInit((game) => {
  game.addSystem({
    props: ["health"],
    onChange: (e) => {
      if (e.health !== 0) return;
      game.dispatchTypedEvent(
        "unitDeath",
        new UnitDeathEvent(e, getDamageSource()),
      );
      game.delete(e);
    },
  });
});
