import { angleDifference, Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";

export const facingWithin = (entity: Entity, target: Point, angle: number) => {
  if (typeof entity.facing !== "number" || !entity.position) return false;
  let facing = entity.facing ?? Math.PI * 3 / 2;
  const targetAngle = Math.atan2(
    target.y - entity.position.y,
    target.x - entity.position.x,
  );
  const diff = Math.abs(angleDifference(facing, targetAngle));
  return diff < angle;
};
