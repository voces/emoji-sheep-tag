import { playEntitySound, playSoundAt } from "../api/sound.ts";
import { app } from "../ecs.ts";
import { stateVar } from "../ui/vars/state.ts";
import { selection } from "./autoSelect.ts";

app.addSystem({
  props: ["id"],
  onAdd: (e) => {
    if (e.tilemap && e.position && e.owner) {
      playSoundAt("construction1", e.position.x, e.position.y, 0.3);
    }
  },
  onRemove: (e) => {
    if (stateVar() !== "playing" && e.unitType !== "sheep") return;
    if (typeof e.health === "number" && typeof e.maxHealth === "number") {
      playEntitySound(e, ["death"], { volume: e.tilemap ? 0.3 : 1 });
    }
  },
});

app.addSystem({
  props: ["health"],
  onChange: (e) =>
    e.position && playSoundAt("thud1", e.position.x, e.position.y),
});

app.addSystem({
  props: ["selected"],
  onAdd: (e) => {
    if (e === selection.first()) playEntitySound(e, "what");
  },
});

app.addSystem({
  props: ["swing"],
  onAdd: (e) => e.position && playSoundAt("swipe1", e.position.x, e.position.y),
  onChange: (e) =>
    e.position && playSoundAt("swipe1", e.position.x, e.position.y),
});
