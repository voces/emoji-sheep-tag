import { Point } from "@/shared/pathing/math.ts";
import { addEntity } from "@/shared/api/entity.ts";
import { id } from "@/shared/util/id.ts";

export const playSoundAt = (
  position: Point,
  soundName: string,
  maxDuration = 10,
) =>
  addEntity({
    id: id("sound"),
    position: { x: position.x, y: position.y },
    sounds: { birth: [soundName] },
    buffs: [{
      remainingDuration: maxDuration,
      totalDuration: maxDuration,
      expiration: "Sound",
    }],
    isDoodad: true,
  });
