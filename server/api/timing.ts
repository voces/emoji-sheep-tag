import { addSystem, appContext } from "@/shared/context.ts";
import type { Game } from "../ecs.ts";
import { TICK_RATE } from "@/shared/constants.ts";
import type { App } from "@verit/ecs";
import type { Entity } from "@/shared/types.ts";

export const getTick = () => (appContext.current as Game).tick;

type Timer = {
  targetTick: number;
  cb: () => void;
  intervalTicks?: number;
  cancelled: boolean;
};

const appTimers = new WeakMap<App<Entity>, Timer[]>();

const getTimers = (): Timer[] => {
  const app = appContext.current;
  let timers = appTimers.get(app);
  if (!timers) {
    timers = [];
    appTimers.set(app, timers);
  }
  return timers;
};

addSystem({
  update: () => {
    const tick = getTick();
    const timers = getTimers();
    for (let i = timers.length - 1; i >= 0; i--) {
      const timer = timers[i];
      if (timer.cancelled) {
        timers.splice(i, 1);
        continue;
      }
      if (tick >= timer.targetTick) {
        timer.cb();
        if (timer.intervalTicks) {
          timer.targetTick += timer.intervalTicks;
        } else {
          timers.splice(i, 1);
        }
      }
    }
  },
});

export const timeout = (cb: () => void, seconds: number): () => void => {
  const tick = getTick();
  const targetTick = tick + Math.max(1, Math.round(seconds / TICK_RATE));
  const timer: Timer = { targetTick, cb, cancelled: false };
  getTimers().push(timer);
  return () => {
    timer.cancelled = true;
  };
};

export const interval = (cb: () => void, seconds: number): () => void => {
  const tick = getTick();
  const intervalTicks = Math.max(1, Math.round(seconds / TICK_RATE));
  const targetTick = tick + intervalTicks;
  const timer: Timer = {
    targetTick,
    cb,
    intervalTicks,
    cancelled: false,
  };
  getTimers().push(timer);
  return () => {
    timer.cancelled = true;
  };
};
