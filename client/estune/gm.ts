/**
 * General MIDI instrument names.
 * Used by the UI, CLI, and ABC exporter to display instrument names.
 * Only includes instruments relevant to our game music context.
 */

export const GM_INSTRUMENT_NAMES: Record<number, string> = {
  // Keyboards
  0: "Piano",
  1: "Bright Piano",
  6: "Harpsichord",
  8: "Celesta",

  // Chromatic percussion
  9: "Glockenspiel",
  10: "Music Box",
  11: "Vibraphone",
  12: "Marimba",
  13: "Xylophone",
  14: "Tubular Bells",
  15: "Dulcimer",

  // Guitar
  24: "Nylon Guitar",
  25: "Steel Guitar",

  // Strings
  40: "Violin",
  41: "Viola",
  42: "Cello",
  43: "Contrabass",
  44: "Tremolo Strings",
  45: "Pizzicato Strings",
  46: "Harp",
  47: "Timpani",
  48: "String Ensemble",
  49: "Slow Strings",

  // Choir
  52: "Choir Aahs",
  53: "Voice Oohs",

  // Brass
  56: "Trumpet",
  57: "Trombone",
  58: "Tuba",
  59: "Muted Trumpet",
  60: "French Horn",
  61: "Brass Section",

  // Woodwinds
  68: "Oboe",
  69: "English Horn",
  70: "Bassoon",
  71: "Clarinet",
  72: "Piccolo",
  73: "Flute",
  74: "Recorder",
  75: "Pan Flute",

  // Ethnic
  108: "Kalimba",
  110: "Fiddle",

  // Percussion
  116: "Taiko Drum",
};

/** Get the GM instrument name, or a fallback like "GM71". */
export function gmName(program: number): string {
  return GM_INSTRUMENT_NAMES[program] ?? `GM${program}`;
}
