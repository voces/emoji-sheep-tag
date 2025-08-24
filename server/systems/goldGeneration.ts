import { addSystem } from "@/shared/context.ts";
import { data } from "../st/data.ts";

addSystem({
  props: ["isPlayer", "owner"],
  updateEntity: (entity, delta) => {
    if (!entity.owner) return;

    // Determine if player is sheep or wolf
    const isSheep = data.sheep.some((s) => s.client.id === entity.owner);
    const isWolf = data.wolves.some((w) => w.client.id === entity.owner);

    if (!isSheep && !isWolf) return;

    // Determine gold generation rate based on team
    const goldPerSecond = isSheep ? 1 : (1 / 1.5); // Sheep: 1/second, Wolf: 1/1.5 seconds

    // Increment gold continuously based on delta time
    entity.gold = (entity.gold ?? 0) + (goldPerSecond * delta);
  },
});
