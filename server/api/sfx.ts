import { Point } from "@/shared/pathing/math.ts";
import { addEntity } from "@/shared/api/entity.ts";

export const newSfx = (
  position: Point,
  modelName: string,
  facing = 0,
  duration = 1,
  easing?: {
    type: "ease-in" | "ease-out" | "ease-in-out";
    duration: number;
  },
) => {
  const entity = {
    id: `sfx-${Date.now()}-${Math.random()}`,
    position: { x: position.x, y: position.y },
    model: modelName,
    facing,
    buffs: [{
      remainingDuration: duration,
      expiration: "SFX",
      ...(easing && {
        progressEasing: {
          type: easing.type,
          duration: easing.duration,
        },
      }),
    }],
    // Set initial progress based on easing type
    ...(easing && {
      progress: easing.type === "ease-out" ? 1 : 0,
    }),
  };

  return addEntity(entity);
};
