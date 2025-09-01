import pureRand from "npm:pure-rand";

export const prand = (seed: number) => {
  const rng = pureRand.xoroshiro128plus(seed);
  return () => (rng.unsafeNext() >>> 0) / 0x100000000;
};
