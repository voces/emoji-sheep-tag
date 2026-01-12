import { isAlly, isInvisible } from "@/shared/api/unit.ts";
import { app, Entity } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import { getPlayer } from "@/shared/api/player.ts";
import { computeBlueprintColor } from "../util/colorHelpers.ts";
import { prefabs } from "@/shared/data.ts";

const applyModifiers = (e: Entity) => {
  const p = getLocalPlayer();

  const baseAlpha = e.prefab ? prefabs[e.prefab]?.alpha ?? 1 : 1;
  let alpha = baseAlpha;
  let vertexColor = 0xffffff;

  if (e.isMirror && p && isAlly(e, p.id)) {
    const playerColor = getPlayer(e.owner)?.playerColor ?? p.playerColor;
    vertexColor = playerColor
      ? computeBlueprintColor(playerColor, 0x0000ff)
      : 0x0000ff;
    alpha *= 0.85;
  }

  if (isInvisible(e)) alpha *= 0.4;

  const reducedSpeed = e.buffs?.reduce(
    (reducedSpeed, b) =>
      reducedSpeed * Math.min(b.movementSpeedMultiplier ?? 1, 1),
    1,
  ) ?? 1;
  if (reducedSpeed < 1) {
    const r = Math.round((vertexColor & 0xff0000) / 65536 * reducedSpeed) *
      65536;
    const g = Math.round((vertexColor & 0xff00) / 256 * reducedSpeed) * 256;
    const b = vertexColor & 0xff;
    vertexColor = r + g + b;
  }

  e.alpha = alpha;

  if (vertexColor === 0xffffff) delete e.vertexColor;
  else e.vertexColor = vertexColor;
};

app.addSystem({
  props: ["isMirror"],
  onAdd: applyModifiers,
});

app.addSystem({
  props: ["buffs"],
  onAdd: applyModifiers,
  onChange: applyModifiers,
  onRemove: applyModifiers,
});

app.addSystem({
  props: ["progress"],
  onAdd: applyModifiers,
  onChange: applyModifiers,
  onRemove: applyModifiers,
});
