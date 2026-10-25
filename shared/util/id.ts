import { nextSimSerial } from "./simRandom.ts";

// Alphanumeric, minus 0, O, l, and I
const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const toBase58 = (num: number): string => {
  let result = "";
  while (num > 0) {
    result = chars[num % 58] + result;
    num = Math.floor(num / 58);
  }
  return result || "1";
};

// Six base58 digits hold any u32, so a seeded id's seed part has fixed width
const SEED_WIDTH = 6;

let counter = 0;
let counterSecond = 0;

const wallClockId = () => {
  const second = Math.floor(Date.now() / 1000);
  if (counterSecond !== second) {
    counter = 0;
    counterSecond = second;
  }
  return `1${toBase58(second)}${toBase58(counter++)}`;
};

/**
 * Inside a seeded app (a server round) ids derive from the round's seed and a
 * per-round serial, so a replay produces the same ids; elsewhere they derive
 * from the wall clock.
 */
export const id = (type?: string) => {
  const sim = nextSimSerial();
  const body = sim
    ? `r${toBase58(sim.seed).padStart(SEED_WIDTH, "1")}${toBase58(sim.serial)}`
    : wallClockId();
  return type ? `${type}-${body}` : body;
};
