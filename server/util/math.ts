import { DEFAULT_FACING } from "../../shared/constants.ts";
import { angleDifference, Point } from "../../shared/pathing/math.ts";
import { Entity } from "../../shared/types.ts";

export const facingWithin = (entity: Entity, target: Point, angle: number) => {
  if (typeof entity.facing !== "number" || !entity.position) return false;
  const facing = entity.facing ?? DEFAULT_FACING;
  const targetAngle = Math.atan2(
    target.y - entity.position.y,
    target.x - entity.position.x,
  );
  const diff = Math.abs(angleDifference(facing, targetAngle));
  return diff < angle;
};
