import { isAlly } from "@/shared/api/unit.ts";
import { app } from "../ecs.ts";
import { getLocalPlayer, getPlayer } from "../ui/vars/players.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";

app.addSystem({
  props: ["isMirror"],
  onAdd: (e) => {
    const p = getLocalPlayer();
    if (p && isAlly(e, p.id)) {
      const playerColor = e.owner ? getPlayer(e.owner)?.color : p.color;
      e.vertexColor = playerColor
        ? computeBlueprintColor(playerColor, 0x0000ff)
        : 0x0000ff;
      e.alpha = 0.85;
    }
  },
});
