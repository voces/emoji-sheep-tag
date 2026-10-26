import { Pathing } from "./types.ts";

/** Pathing bits an entity can contribute; see PATHING_* in ../constants.ts. */
const BITS = 8;

/**
 * A PathingMap's tile state as flat arrays, indexed `y * width + x`, so the
 * search can read it without touching Tile objects.
 *
 * `pathing` holds -1 until PathingMap creates the tile: a tile that was never
 * created blocks line of sight, so that is part of the state. Entities
 * contribute pathing bits through per-bit counts, which makes adding and
 * removing one O(1) per tile instead of re-ORing every entity on it.
 */
export class FlatGrid {
  readonly pathing: Int32Array;
  readonly original: Int32Array;
  /** Each tile's pathing before entities, or -1 where it has no terrain. */
  readonly terrain: Int32Array;
  private readonly counts: Uint16Array;

  constructor(readonly width: number, readonly height: number) {
    const n = width * height;
    this.pathing = new Int32Array(n).fill(-1);
    this.original = new Int32Array(n);
    this.terrain = new Int32Array(n).fill(-1);
    this.counts = new Uint16Array(n * BITS);
  }

  /** Creates the tile at `index` if it has terrain; whether it exists. */
  ensure(index: number): boolean {
    if (this.pathing[index] !== -1) return true;
    const terrain = this.terrain[index];
    if (terrain === -1) return false;
    this.create(index, terrain);
    return true;
  }

  create(index: number, original: Pathing) {
    this.original[index] = original;
    this.pathing[index] = original | this.entityBits(index);
  }

  setOriginal(index: number, original: Pathing) {
    this.original[index] = original;
    this.pathing[index] = original | this.entityBits(index);
  }

  add(index: number, pathing: Pathing) {
    if (pathing >>> BITS) throw new Error(`Unsupported pathing ${pathing}`);
    const base = index * BITS;
    for (let bit = 0; pathing >> bit; bit++) {
      if ((pathing >> bit) & 1 && this.counts[base + bit]++ === 0) {
        this.pathing[index] |= 1 << bit;
      }
    }
  }

  remove(index: number, pathing: Pathing) {
    const base = index * BITS;
    for (let bit = 0; pathing >> bit; bit++) {
      if ((pathing >> bit) & 1 && --this.counts[base + bit] === 0) {
        this.pathing[index] = this.original[index] |
          this.entityBits(index);
      }
    }
  }

  private entityBits(index: number) {
    const base = index * BITS;
    let bits = 0;
    for (let bit = 0; bit < BITS; bit++) {
      if (this.counts[base + bit]) bits |= 1 << bit;
    }
    return bits;
  }
}
