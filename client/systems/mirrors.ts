import { isAlly } from "../api/unit.ts";
import { app } from "../ecs.ts";
import { getLocalPlayer } from "../ui/vars/players.ts";

app.addSystem({
  props: ["isMirror"],
  onAdd: (e) => {
    const p = getLocalPlayer();
    if (p && isAlly(e, p)) e.blueprint = 0x0000ff;
  },
});
