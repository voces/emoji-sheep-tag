import { appContext } from "../context.ts";

/**
 * mulberry32. Every step is 32-bit integer arithmetic, so any other
 * implementation of the simulation (e.g. a wasm port) can reproduce the
 * stream bit for bit.
 */
export const mulberry32 = (seed: number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;

type SimState = {
  seed: number;
  random: () => number;
  cosmeticRandom: () => number;
  nextId: number;
};

const states = new WeakMap<object, SimState>();

/**
 * Makes an app's randomness and entity ids a pure function of `seed`, so a
 * round replays exactly from its seed and inputs. Gameplay and cosmetic draws
 * use separate streams: a change to a sound or particle pick must not shift
 * the gameplay stream and desync every later tick.
 */
export const seedApp = (app: object, seed: number) =>
  void states.set(app, {
    seed,
    random: mulberry32(seed),
    cosmeticRandom: mulberry32(seed ^ 0x9e3779b9),
    nextId: 0,
  });

const current = () => {
  const app = appContext.maybeCurrent;
  return app ? states.get(app) : undefined;
};

export const getAppSeed = (app: object) => states.get(app)?.seed;

/** Gameplay randomness; Math.random outside a seeded app. */
export const simRandom = () => current()?.random() ?? Math.random();

/** Randomness for effects that do not change gameplay (sounds, visuals). */
export const cosmeticRandom = () =>
  current()?.cosmeticRandom() ?? Math.random();

/**
 * The next entity serial of the current seeded app, with its seed, or
 * undefined outside one.
 */
export const nextSimSerial = () => {
  const state = current();
  return state ? { seed: state.seed, serial: state.nextId++ } : undefined;
};
