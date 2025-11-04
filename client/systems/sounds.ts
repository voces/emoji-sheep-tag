import { playEntitySound, playSoundAt } from "../api/sound.ts";
import { stateVar } from "@/vars/state.ts";
import { selection } from "./autoSelect.ts";
import { addSystem } from "@/shared/context.ts";
import { Entity } from "../ecs.ts";

addSystem({
  props: ["id"],
  onAdd: (e) => {
    if (e.sounds?.birth) playEntitySound(e, "birth", { volume: 0.5 });
  },
  onRemove: (e) => {
    if (stateVar() !== "playing") return;
    if (e.sounds?.death) {
      if (
        typeof e.health === "number" && typeof e.maxHealth === "number" ||
        e.projectile
      ) {
        playEntitySound(e, ["death"], { volume: e.tilemap ? 0.3 : 0.6 });
      }
    }
  },
});

addSystem({
  props: ["health"],
  onChange: (e) =>
    (typeof e.health !== "number" || e.health > 0) && e.position &&
    e.lastAttacker &&
    playSoundAt("thud1", e.position.x, e.position.y, 0.2),
});

addSystem<Entity, "selected">({
  props: ["selected"],
  onAdd: (e) => {
    if (e === selection.first()) playEntitySound(e, "what", { volume: 0.6 });
  },
});

addSystem({
  props: ["swing"],
  onAdd: (e) =>
    // TODO: use a sound set
    e.position && playSoundAt("swipe1", e.position.x, e.position.y, 0.3),
  // onChange: (e) =>
  //   e.position && playSoundAt("swipe1", e.position.x, e.position.y, 0.3),
});
