/**
 * Dense, JSON-safe tilemap codec for Deno + browsers.
 * Format:
 *  - u16le width, u16le height, u8 b (bits per value)
 *  - Row 0: sequence of tokens (LIT or REP)
 *  - Rows 1..H-1: sequence of tokens (ABOVE, REP, LIT)
 * Tokens (1 byte header + payload):
 *  - type in top 2 bits: 00=LIT, 01=REP, 10=ABOVE, 11=ROWREP
 *  - length-1 in low 6 bits; if 63, an extended length varint (LEB128) follows (byte-aligned)
 *  - LIT payload: len * b bits of values
 *  - REP payload: 1 value (b bits) repeated len times
 *  - ABOVE payload: none (copy from row-1 for len cells)
 *  - ROWREP payload: none (whole row = previous row; only valid for y>0)
 */

export function packMap2D(tiles: number[][], maxIndex: number): string {
  const H = tiles.length;
  if (H === 0) return toBase64(new Uint8Array([0, 0, 0, 0, 0])); // 0x0000 width/height + b=0
  const W = tiles[0].length;
  if (!Number.isInteger(W) || W <= 0) {
    throw new Error("Non-empty rectangular map required");
  }
  for (const row of tiles) {
    if (row.length !== W) throw new Error("Ragged rows not supported");
  }
  if (!Number.isInteger(maxIndex) || maxIndex < 0) {
    throw new Error("maxIndex must be >= 0");
  }

  const b = bitsPer(maxIndex);
  const bw = new BitWriter();

  // Header: width (u16le), height (u16le), b (u8)
  bw.writeU16LE(W);
  bw.writeU16LE(H);
  bw.writeU8(b);

  // Row 0: horizontal RLE (REP/LIT)
  emitRow0(bw, tiles[0], b);

  // Rows 1..H-1: vertical-aware encoding
  for (let y = 1; y < H; y++) {
    const row = tiles[y];
    const prev = tiles[y - 1];

    // If whole row identical to previous, ROWREP token and continue
    let same = true;
    for (let x = 0; x < W; x++) {
      if (row[x] !== prev[x]) {
        same = false;
        break;
      }
    }
    if (same) {
      writeTokenHeader(bw, 0b11, 1); // length=1 stands for "whole row"
      continue;
    }

    // Walk the row, grouping ABOVE spans and non-ABOVE spans.
    let x = 0;
    while (x < W) {
      // ABOVE span
      if (row[x] === prev[x]) {
        let x2 = x + 1;
        while (x2 < W && row[x2] === prev[x2]) x2++;
        emitAbove(bw, x2 - x);
        x = x2;
        continue;
      }

      // Non-ABOVE span: choose REP if constant, else LIT; keep it single-type until it breaks.
      let x2 = x + 1;
      const v0 = row[x];
      let constant = true;
      while (x2 < W && row[x2] !== prev[x2]) {
        if (constant && row[x2] !== v0) constant = false;
        // If constant broke, we still continue this non-ABOVE span as LIT until an ABOVE starts
        x2++;
      }
      const len = x2 - x;

      if (constant) {
        emitRep(bw, len, v0, b);
      } else {
        emitLit(bw, row, x, len, b);
      }
      x = x2;
    }
  }

  return toBase64(bw.finish());
}

export function unpackMap2D(b64: string): number[][] {
  const buf = fromBase64(b64);
  const br = new BitReader(buf);

  const W = br.readU16LE();
  const H = br.readU16LE();
  const b = br.readU8();

  if (W === 0 || H === 0) return [];

  const out: number[][] = Array.from({ length: H }, () => new Array<number>(W));

  // Row 0
  decodeRow0(br, out[0], W, b);

  // Rows 1..H-1
  for (let y = 1; y < H; y++) {
    const row = out[y];
    const prev = out[y - 1];

    let filled = 0;
    while (filled < W) {
      const { type, len } = readTokenHeader(br);
      switch (type) {
        case 0b11: { // ROWREP — entire row equals previous
          if (len !== 1 || filled !== 0) {
            throw new Error("Corrupt ROWREP position");
          }
          for (let x = 0; x < W; x++) row[x] = prev[x];
          filled = W;
          break;
        }
        case 0b10: { // ABOVE
          for (let i = 0; i < len; i++) row[filled + i] = prev[filled + i];
          filled += len;
          break;
        }
        case 0b01: { // REP
          const v = br.readBits(b);
          for (let i = 0; i < len; i++) row[filled + i] = v;
          filled += len;
          break;
        }
        case 0b00: { // LIT
          for (let i = 0; i < len; i++) row[filled + i] = br.readBits(b);
          filled += len;
          break;
        }
        default:
          throw new Error("Invalid token");
      }
    }
  }

  return out;
}

// ---------- Encoding helpers ----------

function emitRow0(bw: BitWriter, row: number[], b: number) {
  const W = row.length;
  let x = 0;
  while (x < W) {
    // Try REP
    const v0 = row[x];
    let x2 = x + 1;
    while (x2 < W && row[x2] === v0) x2++;
    const run = x2 - x;
    if (run >= 2) {
      emitRep(bw, run, v0, b);
      x = x2;
      continue;
    }
    // Otherwise LIT until next REP or end
    const start = x++;
    while (x < W) {
      const v = row[x];
      if (x + 1 < W && row[x + 1] === v) break; // upcoming REP
      x++;
    }
    emitLit(bw, row, start, x - start, b);
  }
}

function emitAbove(bw: BitWriter, len: number) {
  writeTokenHeader(bw, 0b10, len);
}

function emitRep(bw: BitWriter, len: number, value: number, b: number) {
  writeTokenHeader(bw, 0b01, len);
  bw.writeBits(value, b);
}

function emitLit(
  bw: BitWriter,
  src: number[],
  start: number,
  len: number,
  b: number,
) {
  writeTokenHeader(bw, 0b00, len);
  for (let i = 0; i < len; i++) bw.writeBits(src[start + i], b);
}

// ---------- Decoding2 helpers ----------

function decodeRow0(br: BitReader, row: number[], W: number, b: number) {
  let filled = 0;
  while (filled < W) {
    const { type, len } = readTokenHeader(br);
    switch (type) {
      case 0b01: { // REP
        const v = br.readBits(b);
        for (let i = 0; i < len; i++) row[filled + i] = v;
        filled += len;
        break;
      }
      case 0b00: { // LIT
        for (let i = 0; i < len; i++) row[filled + i] = br.readBits(b);
        filled += len;
        break;
      }
      default:
        throw new Error("Row0 may only contain REP or LIT tokens");
    }
  }
  if (filled !== W) throw new Error("Corrupt Row0 decode (wrong length)");
}

// ---------- Token header (2-bit type + length) ----------

function writeTokenHeader(bw: BitWriter, type2: number, len: number) {
  if (len <= 0) throw new Error("len must be > 0");
  const base = Math.min(len - 1, 63);
  bw.writeU8((type2 << 6) | base);
  if (base === 63 && len > 64) {
    bw.alignToByte();
    writeVarint(bw, len - 64);
  }
}

function readTokenHeader(br: BitReader): { type: number; len: number } {
  const h = br.readU8();
  const type = (h >>> 6) & 0b11;
  let len = (h & 0x3f) + 1;
  if ((h & 0x3f) === 63) {
    br.alignToByte();
    len += readVarint(br);
  }
  return { type, len };
}

// ---------- Bit IO + Base64 ----------

class BitWriter {
  private buf: number[] = [];
  private bitPos = 0;

  writeU8(v: number) {
    this.writeBits(v & 0xff, 8);
  }
  writeU16LE(v: number) {
    this.writeU8(v & 0xff);
    this.writeU8((v >>> 8) & 0xff);
  }
  writeBits(value: number, width: number) {
    let remaining = width, v = value >>> 0;
    while (remaining > 0) {
      const byteIndex = this.bitPos >>> 3;
      const bitIndex = this.bitPos & 7;
      if (byteIndex === this.buf.length) this.buf.push(0);
      const space = 8 - bitIndex;
      const take = Math.min(space, remaining);
      const mask = (1 << take) - 1;
      const bits = (v & mask) << bitIndex;
      this.buf[byteIndex] = (this.buf[byteIndex] | bits) & 0xff;
      v >>>= take;
      remaining -= take;
      this.bitPos += take;
    }
  }
  alignToByte() {
    const m = this.bitPos & 7;
    if (m) this.bitPos += 8 - m;
  }
  finish(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

class BitReader {
  private view: Uint8Array;
  private bitPos = 0;
  constructor(buf: Uint8Array) {
    this.view = buf;
  }
  readU8(): number {
    return this.readBits(8) & 0xff;
  }
  readU16LE(): number {
    const a = this.readU8();
    const b = this.readU8();
    return a | (b << 8);
  }
  readU8Aligned(): number {
    this.alignToByte();
    return this.readU8();
  }
  readBits(width: number): number {
    let remaining = width, out = 0, shift = 0;
    while (remaining > 0) {
      const byteIndex = this.bitPos >>> 3;
      if (byteIndex >= this.view.length) throw new Error("Unexpected EOF");
      const bitIndex = this.bitPos & 7;
      const space = 8 - bitIndex;
      const take = Math.min(space, remaining);
      const mask = (1 << take) - 1;
      const chunk = (this.view[byteIndex] >>> bitIndex) & mask;
      out |= chunk << shift;
      shift += take;
      remaining -= take;
      this.bitPos += take;
    }
    return out >>> 0;
  }
  alignToByte() {
    const m = this.bitPos & 7;
    if (m) this.bitPos += 8 - m;
  }
}

function writeVarint(bw: BitWriter, n: number) {
  if (n < 0) throw new Error("varint must be >= 0");
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) byte |= 0x80;
    bw.writeU8(byte);
  } while (n !== 0);
}

function readVarint(br: BitReader): number {
  let shift = 0, result = 0;
  for (let i = 0; i < 5; i++) {
    const byte = br.readU8();
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
  throw new Error("varint too long");
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function bitsPer(maxIndex: number): number {
  if (maxIndex < 0) throw new Error("maxIndex must be >= 0");
  if (maxIndex === 0) return 0;
  let b = 0, x = maxIndex;
  while (x > 0) {
    b++;
    x >>>= 1;
  }
  return b;
}
