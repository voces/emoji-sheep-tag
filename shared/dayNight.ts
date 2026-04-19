import type { Entity } from "./types.ts";
import { addSystem, appContext } from "./context.ts";
import type { App } from "@verit/ecs";

export const NIGHT_SIGHT_MULTIPLIER = 0.8;
const INITIAL_NIGHT_DURATION = 6; // countdown (3s) + first 3s of headstart
const NIGHT_DURATION = 75; // 1:15
const DAY_DURATION = 120; // 2:00

export const computeIsNight = (elapsed: number): boolean => {
  if (elapsed < INITIAL_NIGHT_DURATION) return true;
  const afterInitialNight = elapsed - INITIAL_NIGHT_DURATION;
  const cycleLength = DAY_DURATION + NIGHT_DURATION;
  const positionInCycle = afterInitialNight % cycleLength;
  return positionInCycle >= DAY_DURATION;
};

type TimerEntry = { entity: Entity; offset: number };
const timerMap = new WeakMap<App<Entity>, TimerEntry>();

const TIMER_OFFSETS: Record<string, number> = {
  "Time until sheep spawn:": 0,
  "Time until wolves spawn:": 3,
  "Time until sheep win:": 21,
};

export const getRoundElapsed = (): number => {
  const entry = timerMap.get(appContext.current);
  if (!entry?.entity.buffs?.[0]) return 0;
  const buff = entry.entity.buffs[0];
  return entry.offset +
    (buff.totalDuration ?? 0) - (buff.remainingDuration ?? 0);
};

export const getGameElapsed = (): number => Math.max(0, getRoundElapsed() - 21);

export const isNight = (): boolean => {
  const entry = timerMap.get(appContext.current);
  if (!entry) return false; // Day during lobby/intermission
  return computeIsNight(getRoundElapsed());
};

addSystem({
  props: ["isTimer", "buffs"],
  onAdd: (e) => {
    const expiration = e.buffs?.[0]?.expiration;
    if (expiration && expiration in TIMER_OFFSETS) {
      timerMap.set(appContext.current, {
        entity: e,
        offset: TIMER_OFFSETS[expiration],
      });
    }
  },
  onRemove: (e) => {
    const entry = timerMap.get(appContext.current);
    if (entry?.entity === e) timerMap.delete(appContext.current);
  },
});
