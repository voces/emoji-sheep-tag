import { Point } from "@/shared/pathing/math.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { Entity } from "@/shared/types.ts";

export const newSfx = (
  position: Point,
  modelName: string,
  facing = 0,
  duration = 1,
  easing?: "ease-in" | "ease-out" | "ease-in-out",
  easingDuration = duration,
  extra?: Partial<Entity>,
) =>
  addEntity({
    id: `sfx-${Date.now()}-${Math.random()}`,
    position: { x: position.x, y: position.y },
    model: modelName,
    facing,
    buffs: [{
      remainingDuration: duration,
      totalDuration: duration,
      expiration: "SFX",
      ...(easing && {
        progressEasing: {
          type: easing,
          duration: easingDuration,
        },
      }),
    }],
    // Set initial progress based on easing type
    ...(easing && {
      progress: easing === "ease-out" ? 1 : 0,
    }),
    isDoodad: true,
    ...extra,
  });
