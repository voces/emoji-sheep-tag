import { app } from "../ecs.ts";

const easeInQuad = (t: number) => t * t;
const easeOutQuad = (t: number) => t * (2 - t);
const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

app.addSystem({
  props: ["buffs", "progress"],
  updateEntity: (e, delta) => {
    const easingBuff = e.buffs?.find((buff) => buff.progressEasing);
    if (!easingBuff?.progressEasing) return;

    const { type, duration } = easingBuff.progressEasing;

    // Initialize client-side elapsed time tracking if not present
    if (e.clientElapsedTime === undefined) {
      e.clientElapsedTime = 0;
    }

    // Update elapsed time using delta for smooth interpolation
    e.clientElapsedTime += delta;

    // Calculate easing progress based on client-side elapsed time
    const easingProgress = Math.min(e.clientElapsedTime / duration, 1);

    let progress: number;

    switch (type) {
      case "ease-in":
        progress = easeInQuad(easingProgress);
        break;
      case "ease-out":
        progress = 1 - easeOutQuad(easingProgress);
        break;
      case "ease-in-out":
        // Ease from 0 -> 1 -> 0 (pulse/wave effect)
        progress = easingProgress < 0.5
          ? easeInOutQuad(easingProgress * 2)
          : easeInOutQuad((1 - easingProgress) * 2);
        break;
      default:
        progress = e.progress ?? 0;
    }

    e.progress = Math.max(0, Math.min(1, progress));
  },
});
