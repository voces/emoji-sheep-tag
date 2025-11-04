import { isAlly } from "@/shared/api/unit.ts";
import { app } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";

app.addSystem({
  props: ["isMirror"],
  onAdd: (e) => {
    const p = getLocalPlayer();
    if (p && isAlly(e, p.id)) {
      const playerColor = getPlayer(e.owner)?.playerColor ?? p.playerColor;
      e.vertexColor = playerColor
        ? computeBlueprintColor(playerColor, 0x0000ff)
        : 0x0000ff;
      e.alpha = 0.85;
    }
  },
});
