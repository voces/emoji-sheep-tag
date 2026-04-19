const charMap: Record<string, string> = {
  a: "\u00e5",
  b: "\u0180",
  c: "\u00e7",
  d: "\u00f0",
  e: "\u00e9",
  f: "\u0192",
  g: "\u011d",
  h: "\u0125",
  i: "\u00ee",
  j: "\u0135",
  k: "\u0137",
  l: "\u013c",
  m: "\u1e3f",
  n: "\u00f1",
  o: "\u00f6",
  p: "\u00fe",
  q: "\u01eb",
  r: "\u0155",
  s: "\u0161",
  t: "\u0163",
  u: "\u00fb",
  v: "\u1e7d",
  w: "\u0175",
  x: "\u1e8b",
  y: "\u00fd",
  z: "\u017e",
  A: "\u00c5",
  B: "\u0181",
  C: "\u00c7",
  D: "\u00d0",
  E: "\u00c9",
  F: "\u0191",
  G: "\u011c",
  H: "\u0124",
  I: "\u00ce",
  J: "\u0134",
  K: "\u0136",
  L: "\u013b",
  M: "\u1e3e",
  N: "\u00d1",
  O: "\u00d6",
  P: "\u00de",
  Q: "\u01ea",
  R: "\u0154",
  S: "\u0160",
  T: "\u0162",
  U: "\u00db",
  V: "\u1e7c",
  W: "\u0174",
  X: "\u1e8a",
  Y: "\u00dd",
  Z: "\u017d",
};

const pseudoChar = (c: string) => charMap[c] ?? c;

const pseudoString = (s: string): string =>
  `[${
    s.replace(/(\{\{.*?\}\})|(.)/g, (_, interp, ch) => interp ?? pseudoChar(ch))
  }]`;

// deno-lint-ignore no-explicit-any
const pseudoDeep = (obj: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === "string" ? pseudoString(v) : pseudoDeep(v),
    ]),
  );

export const generatePseudo = (source: Record<string, unknown>) =>
  pseudoDeep(source as Record<string, Record<string, unknown>>);
