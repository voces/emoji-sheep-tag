import { SystemEntity } from "../ecs.ts";
import { getLocalPlayer } from "../api/player.ts";
import { addSystem, appContext } from "@/shared/context.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";

const indicators = new Map<
  SystemEntity<"prefab" | "modelScale">,
  { birth: number; initialScale: number }
>();

addSystem({
  props: ["prefab", "modelScale"],
  onAdd: (e) => {
    if (e.prefab === "indicator") {
      indicators.set(e, {
        birth: appContext.current.lastUpdate,
        initialScale: e.modelScale,
      });
    }
  },
  onChange: (e) => {
    if (e.prefab !== "indicator") indicators.delete(e);
  },
  onRemove: (e) =>
    indicators.delete(e as SystemEntity<"prefab" | "modelScale">),
  update: (_, time) => {
    for (const [indicator, { birth, initialScale }] of indicators) {
      const next = initialScale - (time * 3 - birth * 3) ** 2;
      if (next < 0.01) removeEntity(indicator);
      else {
        indicator.modelScale = next;
        indicator.facing = ((next - 0.01) / 0.99) ** 0.5 * Math.PI * 2 *
          (indicator.turnSpeed ?? 1);
      }
    }
  },
});

export const newIndicator = (
  position: { x: number; y: number },
  { color = "#33dd33", scale = 1, model = "circle" }: {
    color?: string;
    scale?: number;
    model?: "circle" | "gravity";
  } = {},
) => {
  addEntity({
    id: `indicator-${crypto.randomUUID()}`,
    prefab: "indicator",
    model,
    playerColor: color,
    position,
    modelScale: scale,
    isDoodad: true,
    owner: getLocalPlayer()?.id,
  });
};
