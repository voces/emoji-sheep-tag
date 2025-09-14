import { Entity } from "../types.ts";

// ----------------------------- Schema types ---------------------------------

export type EncoderSpec =
  | { kind: "position"; scale?: number } // {x,y}, fixed-point (default 256)
  | { kind: "number"; scale?: number } // fixed-point (default 256); palette auto
  | { kind: "boolean" } // 1 bit/value
  | { kind: "string" }; // UTF-8; palette auto

export type EntityEncodingSchema<E> = {
  [K in keyof E]?: EncoderSpec;
};

// ------------------------------- Public API ---------------------------------

export const defaultSchema: EntityEncodingSchema<Entity> = {
  prefab: { kind: "string" },
  position: { kind: "position", scale: 1000 },
  facing: { kind: "number", scale: 1 },
  modelScale: { kind: "number", scale: 100 },
  vertexColor: { kind: "number", scale: 1 },
  playerColor: { kind: "string" },
};

export function packEntities(
  entities: Entity[],
  schema: EntityEncodingSchema<Entity> = defaultSchema,
): string {
  const fields = orderedSchemaEntries(schema); // deterministic order

  // Build per-field plans (scale, and auto decision + palette contents if chosen)
  const plans: FieldPlan[] = fields.map(([key, spec]) =>
    analyzeField(entities, String(key), spec!)
  );

  const bw = new BitWriter();
  // Header: version(u8), count(u32), fieldCount(u8)
  bw.writeBits(VERSION, 8);
  writeU32(bw, entities.length >>> 0);
  bw.writeBits(fields.length & 0xff, 8);

  // Field meta section
  for (let i = 0; i < fields.length; i++) {
    const [key] = fields[i];
    writeFieldMeta(bw, String(key), plans[i]);
  }

  // Field data section (columnar)
  for (let i = 0; i < fields.length; i++) {
    const [key, spec] = fields[i];
    writeFieldColumn(bw, entities, String(key), spec!, plans[i]);
  }

  return toBase64(bw.finish());
}

export function unpackEntities(
  b64: string,
  schema: EntityEncodingSchema<Entity> = defaultSchema,
): Partial<Entity>[] {
  const br = new BitReader(fromBase64(b64));
  const version = br.readBits(8);
  if (version !== VERSION) throw new Error(`Unsupported version ${version}`);

  const count = readU32(br) >>> 0;
  const fieldCount = br.readBits(8);

  // Read serialized metas
  const metas: SerializedFieldMeta[] = [];
  for (let i = 0; i < fieldCount; i++) metas.push(readFieldMeta(br));

  // Match against provided schema (names & kinds must match)
  const fields = orderedSchemaEntries(schema);
  if (fields.length !== metas.length) {
    throw new Error(
      "Schema mismatch: encoded field count differs from provided schema.",
    );
  }
  for (let i = 0; i < fields.length; i++) {
    const [key, spec] = fields[i];
    if (metas[i].name !== String(key)) {
      throw new Error(
        `Schema mismatch at #${i}: '${metas[i].name}' ≠ '${String(key)}'`,
      );
    }
    if (kindCode(spec!.kind) !== metas[i].kindCode) {
      throw new Error(`Kind mismatch for '${metas[i].name}'`);
    }
  }

  const out: Partial<Entity>[] = Array.from(
    { length: count },
    () => ({} as Partial<Entity>),
  );

  // Decode each column
  for (let i = 0; i < fields.length; i++) {
    const [key, spec] = fields[i];
    readFieldColumn(br, out, String(key), spec!, metas[i]);
  }
  return out;
}

// -------------------------------- Internals ---------------------------------

const VERSION = 2 as const; // bumped for auto-palette logic in meta

type FieldPlan = {
  name: string;
  kindCode: number; // 0=position,1=number,2=boolean,3=string
  scale: number; // position/number; else 0
  usePalette: boolean; // auto choice for number/string
  paletteStrings?: string[];
  paletteNumbers?: number[]; // quantized ints for numbers
};

type SerializedFieldMeta = {
  name: string;
  kindCode: number;
  flags: number; // bit0 paletteUsed
  aux1: number; // u16 scale for position/number; else 0
};

// Deterministic iteration of schema
function orderedSchemaEntries<E>(
  schema: EntityEncodingSchema<E>,
): [keyof E, EncoderSpec][] {
  return Object.entries(schema) as [keyof E, EncoderSpec][];
}

// ---------- Analyze field: compute scale and auto-palette decision ----------

function analyzeField(
  entities: Entity[],
  name: string,
  spec: EncoderSpec,
): FieldPlan {
  const k = kindCode(spec.kind);
  let scale = 0;
  let usePalette = false;
  let paletteStrings: string[] | undefined;
  let paletteNumbers: number[] | undefined;

  if (spec.kind === "position") {
    scale = spec.scale ?? 256;
  } else if (spec.kind === "number") {
    scale = spec.scale ?? 256;
    // Gather present quantized values
    const vals: number[] = [];
    for (const e of entities) {
      const v = e[name as keyof Entity];
      if (v !== undefined && v !== null) {
        vals.push(Math.round((v as number) * scale));
      }
    }
    // Raw cost (zigzag varints)
    const rawBits = vals.reduce((acc, q) => acc + varintBits(zigzag(q)), 0);

    // Palette candidate (<=256 uniques)
    const unique = Array.from(new Set(vals));
    if (unique.length > 0 && unique.length <= 256) {
      const paletteBitsHeader = varintBits(unique.length) + // palette size
        unique.reduce((acc, q) => acc + varintBits(zigzag(q)), 0);
      const indexBitsPer = bitsFor(Math.max(0, unique.length - 1));
      const indexBits = vals.length * indexBitsPer;

      const palBits = paletteBitsHeader + indexBits;

      if (palBits < rawBits) {
        usePalette = true;
        paletteNumbers = unique;
      }
    }
  } else if (spec.kind === "string") {
    // Gather present strings as UTF-8 bytes
    const present: Uint8Array[] = [];
    const originals: string[] = [];
    for (const e of entities) {
      const v = e[name as keyof Entity];
      if (v !== undefined && v !== null) {
        const s = String(v);
        originals.push(s);
        present.push(enc.encode(s));
      }
    }
    // Raw cost = sum(varint(len) + 8*len)
    const rawBits = present.reduce(
      (acc, bytes) => acc + varintBits(bytes.length) + 8 * bytes.length,
      0,
    );

    // Palette candidate
    const uniqStrings = Array.from(new Set(originals));
    if (uniqStrings.length > 0 && uniqStrings.length <= 256) {
      // Palette header = size + each entry (len varint + bytes)
      const palHeaderBits = varintBits(uniqStrings.length) +
        uniqStrings.reduce((acc, s) => {
          const b = enc.encode(s);
          return acc + varintBits(b.length) + 8 * b.length;
        }, 0);
      const indexBitsPer = bitsFor(Math.max(0, uniqStrings.length - 1));
      const indexBits = originals.length * indexBitsPer;

      const palBits = palHeaderBits + indexBits;

      if (palBits < rawBits) {
        usePalette = true;
        paletteStrings = uniqStrings;
      }
    }
  }

  return {
    name,
    kindCode: k,
    scale,
    usePalette,
    paletteStrings,
    paletteNumbers,
  };
}

// ------------------------- Field meta (name/kind/flags) ---------------------

function writeFieldMeta(
  bw: BitWriter,
  name: string,
  plan: FieldPlan,
) {
  // nameLen(u8) + name(utf8)
  const nameBytes = enc.encode(name);
  if (nameBytes.length > 255) throw new Error("Field name too long");
  bw.writeBits(nameBytes.length, 8);
  for (const b of nameBytes) bw.writeBits(b, 8);

  // kind(u8), flags(u8), aux1(u16)
  bw.writeBits(plan.kindCode, 8);
  const flags = plan.usePalette ? 1 : 0;
  bw.writeBits(flags, 8);
  writeU16(bw, plan.scale & 0xffff);
}

function readFieldMeta(br: BitReader): SerializedFieldMeta {
  const nameLen = br.readBits(8);
  const nameBytes = new Uint8Array(nameLen);
  for (let i = 0; i < nameLen; i++) nameBytes[i] = br.readBits(8);
  const name = dec.decode(nameBytes);
  const kindCode = br.readBits(8);
  const flags = br.readBits(8);
  const aux1 = readU16(br);
  return { name, kindCode, flags, aux1 };
}

function kindCode(kind: EncoderSpec["kind"]): number {
  switch (kind) {
    case "position":
      return 0;
    case "number":
      return 1;
    case "boolean":
      return 2;
    case "string":
      return 3;
  }
}

// ----------------------------- Field columns --------------------------------

function writeFieldColumn(
  bw: BitWriter,
  entities: Entity[],
  name: string,
  spec: EncoderSpec,
  plan: FieldPlan,
) {
  // Presence bitmap (1 bit per entity: 1=present)
  const present: boolean[] = new Array(entities.length);
  for (let i = 0; i < entities.length; i++) {
    const v = entities[i][name as keyof Entity];
    present[i] = v !== undefined && v !== null;
    bw.writeBits(present[i] ? 1 : 0, 1);
  }

  if (spec.kind === "position") {
    const scale = plan.scale || 256;
    let havePrev = false;
    let px = 0, py = 0;
    for (let i = 0; i < entities.length; i++) {
      if (!present[i]) continue;
      const v = entities[i][name as keyof Entity] as { x: number; y: number };
      const xi = Math.round(v.x * scale);
      const yi = Math.round(v.y * scale);
      if (!havePrev) {
        writeVarint(bw, zigzag(xi));
        writeVarint(bw, zigzag(yi));
        havePrev = true;
        px = xi;
        py = yi;
      } else {
        writeVarint(bw, zigzag(xi - px));
        writeVarint(bw, zigzag(yi - py));
        px = xi;
        py = yi;
      }
    }
  } else if (spec.kind === "number") {
    const scale = plan.scale || 256;
    if (plan.usePalette) {
      const pal = plan.paletteNumbers ?? [];
      // palette size + entries (zigzag varints)
      writeVarint(bw, pal.length >>> 0);
      for (const q of pal) writeVarint(bw, zigzag(q));
      // index map
      const index = new Map<number, number>();
      pal.forEach((q, i) => index.set(q, i));
      const bits = bitsFor(Math.max(0, pal.length - 1));
      for (let i = 0; i < entities.length; i++) {
        if (!present[i]) continue;
        const q = Math.round(
          (entities[i][name as keyof Entity] as number) * scale,
        );
        const k = index.get(q);
        if (k === undefined) {
          throw new Error(`Value not in palette for '${name}'`);
        }
        if (bits > 0) bw.writeBits(k, bits);
      }
    } else {
      for (let i = 0; i < entities.length; i++) {
        if (!present[i]) continue;
        const q = Math.round(
          (entities[i][name as keyof Entity] as number) * scale,
        );
        writeVarint(bw, zigzag(q));
      }
    }
  } else if (spec.kind === "boolean") {
    for (let i = 0; i < entities.length; i++) {
      if (!present[i]) continue;
      bw.writeBits(entities[i][name as keyof Entity] ? 1 : 0, 1);
    }
  } else if (spec.kind === "string") {
    if (plan.usePalette) {
      const pal = plan.paletteStrings ?? [];
      // palette size + (len+bytes) for each
      writeVarint(bw, pal.length >>> 0);
      for (const s of pal) {
        const b = enc.encode(s);
        writeVarint(bw, b.length >>> 0);
        for (const byte of b) bw.writeBits(byte, 8);
      }
      // indices
      const index = new Map<string, number>();
      pal.forEach((s, i) => index.set(s, i));
      const bits = bitsFor(Math.max(0, pal.length - 1));
      for (let i = 0; i < entities.length; i++) {
        if (!present[i]) continue;
        const s = String(entities[i][name as keyof Entity]);
        const k = index.get(s);
        if (k === undefined) {
          throw new Error(`Value not in palette for '${name}'`);
        }
        if (bits > 0) bw.writeBits(k, bits);
      }
    } else {
      for (let i = 0; i < entities.length; i++) {
        if (!present[i]) continue;
        const b = enc.encode(String(entities[i][name as keyof Entity]));
        writeVarint(bw, b.length >>> 0);
        for (const byte of b) bw.writeBits(byte, 8);
      }
    }
  }
}

function readFieldColumn(
  br: BitReader,
  out: Partial<Entity>[],
  name: string,
  spec: EncoderSpec,
  meta: SerializedFieldMeta,
) {
  const count = out.length;
  const present: boolean[] = new Array(count);
  for (let i = 0; i < count; i++) present[i] = br.readBits(1) === 1;

  if (spec.kind === "position") {
    const scale = meta.aux1 || 256;
    let havePrev = false, px = 0, py = 0;
    for (let i = 0; i < count; i++) {
      if (!present[i]) continue;
      if (!havePrev) {
        px = unzigzag(readVarint(br));
        py = unzigzag(readVarint(br));
        havePrev = true;
      } else {
        px += unzigzag(readVarint(br));
        py += unzigzag(readVarint(br));
      }
      // deno-lint-ignore no-explicit-any
      (out[i] as any)[name] = { x: px / scale, y: py / scale };
    }
  } else if (spec.kind === "number") {
    const scale = meta.aux1 || 256;
    const usePalette = (meta.flags & 1) !== 0;
    if (usePalette) {
      const n = readVarint(br) >>> 0;
      const pal: number[] = new Array(n);
      for (let i = 0; i < n; i++) pal[i] = unzigzag(readVarint(br));
      const bits = bitsFor(Math.max(0, n - 1));
      for (let i = 0; i < count; i++) {
        if (!present[i]) continue;
        const idx = bits === 0 ? 0 : br.readBits(bits);
        // deno-lint-ignore no-explicit-any
        (out[i] as any)[name] = pal[idx] / scale;
      }
    } else {
      for (let i = 0; i < count; i++) {
        if (!present[i]) continue;
        const q = unzigzag(readVarint(br));
        // deno-lint-ignore no-explicit-any
        (out[i] as any)[name] = q / scale;
      }
    }
  } else if (spec.kind === "boolean") {
    for (let i = 0; i < count; i++) {
      if (!present[i]) continue;
      // deno-lint-ignore no-explicit-any
      (out[i] as any)[name] = br.readBits(1) === 1;
    }
  } else if (spec.kind === "string") {
    const usePalette = (meta.flags & 1) !== 0;
    if (usePalette) {
      const n = readVarint(br) >>> 0;
      const pal: string[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const len = readVarint(br) >>> 0;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) bytes[j] = br.readBits(8);
        pal[i] = dec.decode(bytes);
      }
      const bits = bitsFor(Math.max(0, n - 1));
      for (let i = 0; i < count; i++) {
        if (!present[i]) continue;
        const idx = bits === 0 ? 0 : br.readBits(bits);
        // deno-lint-ignore no-explicit-any
        (out[i] as any)[name] = pal[idx];
      }
    } else {
      for (let i = 0; i < count; i++) {
        if (!present[i]) continue;
        const len = readVarint(br) >>> 0;
        const bytes = new Uint8Array(len);
        for (let j = 0; j < len; j++) bytes[j] = br.readBits(8);
        // deno-lint-ignore no-explicit-any
        (out[i] as any)[name] = dec.decode(bytes);
      }
    }
  }
}

// ---------------------------- Bit helpers & base64 --------------------------

class BitWriter {
  private buf: number[] = [];
  private bitPos = 0;
  writeBits(value: number, width: number) {
    let v = value >>> 0, rem = width;
    while (rem > 0) {
      const byteIndex = this.bitPos >>> 3;
      const inByte = this.bitPos & 7;
      if (byteIndex === this.buf.length) this.buf.push(0);
      const space = 8 - inByte;
      const take = Math.min(space, rem);
      const mask = (1 << take) - 1;
      this.buf[byteIndex] |= ((v & mask) << inByte) & 0xff;
      v >>>= take;
      rem -= take;
      this.bitPos += take;
    }
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
  readBits(width: number): number {
    let out = 0, shift = 0, rem = width;
    while (rem > 0) {
      const byteIndex = this.bitPos >>> 3;
      if (byteIndex >= this.view.length) throw new Error("Unexpected EOF");
      const inByte = this.bitPos & 7;
      const space = 8 - inByte;
      const take = Math.min(space, rem);
      const mask = (1 << take) - 1;
      const chunk = (this.view[byteIndex] >>> inByte) & mask;
      out |= chunk << shift;
      shift += take;
      rem -= take;
      this.bitPos += take;
    }
    return out >>> 0;
  }
}

function writeU16(bw: BitWriter, v: number) {
  bw.writeBits(v & 0xff, 8);
  bw.writeBits((v >>> 8) & 0xff, 8);
}
function writeU32(bw: BitWriter, v: number) {
  writeU16(bw, v & 0xffff);
  writeU16(bw, (v >>> 16) & 0xffff);
}
function readU16(br: BitReader): number {
  const a = br.readBits(8), b = br.readBits(8);
  return a | (b << 8);
}
function readU32(br: BitReader): number {
  const lo = readU16(br), hi = readU16(br);
  return (lo | (hi << 16)) >>> 0;
}

// Varint helpers
function writeVarint(bw: BitWriter, n: number) {
  let v = n >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bw.writeBits(byte, 8);
  } while (v !== 0);
}
function readVarint(br: BitReader): number {
  let shift = 0, result = 0;
  for (let i = 0; i < 5; i++) {
    const byte = br.readBits(8);
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
  throw new Error("varint too long");
}
function varintBits(n: number): number {
  // how many bits to store unsigned varint n
  let v = n >>> 0, bits = 0;
  do {
    bits += 8;
    v >>>= 7;
  } while (v !== 0);
  return bits;
}

// ZigZag
function zigzag(n: number): number {
  return ((n << 1) ^ (n >> 31)) >>> 0;
}
function unzigzag(z: number): number {
  return (z >>> 1) ^ -(z & 1);
}

function bitsFor(maxValue: number): number {
  if (maxValue <= 0) return 0;
  let b = 0, v = maxValue;
  while (v > 0) {
    b++;
    v >>>= 1;
  }
  return b;
}

// Base64 (Web standard)
const enc = new TextEncoder();
const dec = new TextDecoder();

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
