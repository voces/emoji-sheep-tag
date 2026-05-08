import { Point } from "@/shared/pathing/math.ts";
import { addEntity } from "@/shared/api/entity.ts";

export const playSoundAt = (
  position: Point,
  soundName: string,
  maxDuration = 10,
) =>
  addEntity({
    id: `sound-${Date.now()}-${Math.random()}`,
    position: { x: position.x, y: position.y },
    sounds: { birth: [soundName] },
    buffs: [{
      remainingDuration: maxDuration,
      totalDuration: maxDuration,
      expiration: "Sound",
    }],
    isDoodad: true,
    // Audio-only phantom — bypass fog so the birth sound plays regardless
    // of whether the local player can see the source position. Without
    // this, a sheep can't hear the wolf-spawn howl when the map center is
    // outside their vision.
    visibleInFog: true,
  });
