import { Point } from "@/shared/pathing/math.ts";
import { addEntity } from "@/shared/api/entity.ts";

export const playSoundAt = (
  position: Point,
  soundName: string,
  maxDuration = 10,
) => {
  addEntity({
    id: `sound-${Date.now()}-${Math.random()}`,
    position: { x: position.x, y: position.y },
    sounds: { birth: [soundName] },
    buffs: [{ remainingDuration: maxDuration, expiration: "Sound" }],
  });
};
