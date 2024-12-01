import { SystemEntity } from "jsr:@verit/ecs";
import { z } from "npm:zod";

import { BUILD_RADIUS } from "../../shared/data.ts";
import { distanceBetweenPoints } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";
import { build as buildUnit, tempUnit } from "../api/unit.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";
import { calcPath, pathable, withPathingMap } from "../systems/pathing.ts";

export const zBuild = z.object({
  type: z.literal("build"),
  unit: z.string(),
  buildType: z.string(), // literal
  x: z.number(),
  y: z.number(),
});

export const build = (
  client: Client,
  { unit, buildType, x, y }: z.TypeOf<typeof zBuild>,
): Entity | void => {
  const round = lobbyContext.context.round;
  if (!round) return;
  const u = round.lookup[unit];
  if (
    u?.owner !== client.id || !u.position || !u.radius ||
    !u.actions?.some((a) => a.type === "build" && a.unitType === buildType)
  ) return;

  // Interrupt
  delete u.action;
  delete u.queue;

  // Build immediately if in range
  if (distanceBetweenPoints(u.position, { x, y }) <= BUILD_RADIUS) {
    return buildUnit(u, buildType, x, y);
  }

  const temp = tempUnit(client.id, buildType, x, y);
  if (
    !withPathingMap((pm) =>
      pm.withoutEntity(
        u as SystemEntity<Entity, "position" | "radius">,
        () => pathable(temp),
      )
    )
  ) return;

  // Otherwise walk there and build
  const path = calcPath(u, { x, y }).slice(1);
  if (!path.length) return;
  u.action = {
    type: "walk",
    target: { x, y },
    path,
    distanceFromTarget: BUILD_RADIUS,
  };
  u.queue = [{ type: "build", x, y, unitType: buildType }];
};
