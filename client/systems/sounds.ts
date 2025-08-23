import { playEntitySound, playSoundAt } from "../api/sound.ts";
import { app } from "../ecs.ts";
import { getPlayer } from "@/vars/players.ts";
import { stateVar } from "../ui/vars/state.ts";
import { selection } from "./autoSelect.ts";
import { lookup } from "./lookup.ts";
import { addChatMessage } from "@/vars/chat.ts";
import { format } from "../api/player.ts";

app.addSystem({
  props: ["id"],
  onAdd: (e) => {
    if (e.sounds?.birth) playEntitySound(e, "birth", { volume: 0.5 });
  },
  onRemove: (e) => {
    if (stateVar() !== "playing") return;
    if (typeof e.health === "number" && typeof e.maxHealth === "number") {
      playEntitySound(e, ["death"], { volume: e.tilemap ? 0.3 : 0.6 });
    }
    if (e.prefab === "sheep" && e.lastAttacker && e.owner) {
      const killingUnit = lookup[e.lastAttacker];
      if (!killingUnit || !killingUnit.owner) return;
      const killingPlayer = getPlayer(killingUnit.owner);
      const victim = getPlayer(e.owner);
      if (killingPlayer && victim) {
        addChatMessage(`${format(killingPlayer)} killed ${format(victim)}`);
      }
    }
  },
});

app.addSystem({
  props: ["health"],
  onChange: (e) =>
    (typeof e.health !== "number" || e.health > 0) && e.position &&
    e.lastAttacker &&
    playSoundAt("thud1", e.position.x, e.position.y, 0.2),
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
