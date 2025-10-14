import { z } from "zod";
import { Client } from "../client.ts";
import { addEntity, removeEntity } from "@/shared/api/entity.ts";
import { timeout } from "../api/timing.ts";
import { findLastPlayerUnit } from "../systems/playerEntities.ts";

export const zMapPing = z.object({
  type: z.literal("mapPing"),
  x: z.number(),
  y: z.number(),
});

export const mapPing = (
  client: Client,
  { x, y }: z.TypeOf<typeof zMapPing>,
) => {
  if (!client.lobby?.round) return;

  const prev = findLastPlayerUnit(client.id, (e) => e.prefab === "indicator");
  if (prev) removeEntity(prev);

  const pingEntity = addEntity({
    prefab: "indicator",
    model: "location",
    modelScale: 400,
    alpha: 0.25,
    isDoodad: true,
    teamScoped: true,
    owner: client.id,
    turnSpeed: 0.02,
    position: { x, y },
  });

  timeout(() => removeEntity(pingEntity), 10);
};
