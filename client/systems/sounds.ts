import { playEntitySound, playSoundAt } from "../api/sound.ts";
import { app } from "../ecs.ts";
import { stateVar } from "../ui/vars/state.ts";
import { selection } from "./autoSelect.ts";

app.addSystem({
  props: ["id"],
  onAdd: (e) => {
    if (e.sounds?.birth) playEntitySound(e, "birth", { volume: 0.5 });
  },
  onRemove: (e) => {
    if (stateVar() !== "playing" && e.prefab !== "sheep") return;
    if (typeof e.health === "number" && typeof e.maxHealth === "number") {
      playEntitySound(e, ["death"], { volume: e.tilemap ? 0.3 : 0.6 });
    }
  },
});

app.addSystem({
  props: ["health"],
  onChange: (e) =>
    e.position && playSoundAt("thud1", e.position.x, e.position.y, 0.2),
});

app.addSystem({
  props: ["selected"],
  onAdd: (e) => {
    if (e === selection.first()) playEntitySound(e, "what", { volume: 0.6 });
  },
});

app.addSystem({
  props: ["swing"],
  onAdd: (e) =>
    e.position && playSoundAt("swipe1", e.position.x, e.position.y, 0.3),
  // onChange: (e) =>
  //   e.position && playSoundAt("swipe1", e.position.x, e.position.y, 0.3),
});
