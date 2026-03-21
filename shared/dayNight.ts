import type { Entity } from "./types.ts";
import { addSystem, appContext } from "./context.ts";
import type { App } from "@verit/ecs";

export const NIGHT_SIGHT_MULTIPLIER = 0.8;
const INITIAL_DAY_DURATION = 105; // 1:45
const NIGHT_DURATION = 75; // 1:15
const DAY_DURATION = 120; // 2:00

export const computeIsNight = (elapsed: number): boolean => {
  if (elapsed < INITIAL_DAY_DURATION) return false;
  const afterInitialDay = elapsed - INITIAL_DAY_DURATION;
  const cycleLength = NIGHT_DURATION + DAY_DURATION;
  const positionInCycle = afterInitialDay % cycleLength;
  return positionInCycle < NIGHT_DURATION;
};

const timerMap = new WeakMap<App<Entity>, Entity>();

export const getGameElapsed = (): number => {
  const timer = timerMap.get(appContext.current);
  if (!timer?.buffs?.[0]) return 0;
  const buff = timer.buffs[0];
  return (buff.totalDuration ?? 0) - (buff.remainingDuration ?? 0);
};

export const isNight = (): boolean => computeIsNight(getGameElapsed());

addSystem({
  props: ["isTimer", "buffs"],
  onAdd: (e) => {
    if (e.buffs?.[0]?.expiration === "Time until sheep win:") {
      timerMap.set(appContext.current, e);
    }
  },
});
