/**
 * Direct MIDI file writer from SongSection data.
 * No ABC intermediate step — writes Standard MIDI Format 1 directly.
 */

const TICKS_PER_QUARTER = 480;

// ── Low-level MIDI utilities ──

function encodeVLQ(value: number): number[] {
  if (value < 0) value = 0;
  if (value < 0x80) return [value];
  const bytes: number[] = [];
  bytes.push(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    bytes.push((value & 0x7f) | 0x80);
    value >>= 7;
  }
  bytes.reverse();
  return bytes;
}

function writeU16(arr: number[], value: number): void {
  arr.push((value >> 8) & 0xff, value & 0xff);
}

function writeU32(arr: number[], value: number): void {
  arr.push((value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
}

function writeStr(arr: number[], str: string): void {
  for (let i = 0; i < str.length; i++) arr.push(str.charCodeAt(i));
}

function buildTrack(events: number[]): number[] {
  const chunk: number[] = [];
  writeStr(chunk, "MTrk");
  writeU32(chunk, events.length);
  chunk.push(...events);
  return chunk;
}

// ── MIDI event helpers ──

function metaEvent(type: number, data: number[]): number[] {
  return [0xff, type, ...encodeVLQ(data.length), ...data];
}

function tempoEvent(bpm: number): number[] {
  const microsPerBeat = Math.round(60_000_000 / bpm);
  return metaEvent(0x51, [(microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff]);
}

function timeSigEvent(num: number, den: number): number[] {
  const denPow = Math.round(Math.log2(den));
  return metaEvent(0x58, [num, denPow, 24, 8]);
}

function trackNameEvent(name: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < name.length; i++) bytes.push(name.charCodeAt(i));
  return metaEvent(0x03, bytes);
}

function endOfTrack(): number[] {
  return metaEvent(0x2f, []);
}

function programChange(channel: number, program: number): number[] {
  return [0xc0 | channel, program];
}

function noteOn(channel: number, midi: number, velocity: number): number[] {
  return [0x90 | channel, midi & 0x7f, Math.round(Math.max(1, Math.min(127, velocity * 127)))];
}

function noteOff(channel: number, midi: number): number[] {
  return [0x80 | channel, midi & 0x7f, 0];
}

// ── Public API ──

export interface MidiNote {
  /** Absolute beat from song start. */
  beat: number;
  midi: number;
  duration: number;
  velocity: number;
  instrument: number;
  /** Voice/track identifier. */
  voice: string;
}

export interface MidiSongOptions {
  title: string;
  tempo: number;
  meterNum?: number;
  meterDen?: number;
}

/**
 * Write a Standard MIDI File (Format 1) from a flat list of notes.
 * Returns the file as a Uint8Array.
 */
export function writeMidi(notes: MidiNote[], options: MidiSongOptions): Uint8Array {
  const { title, tempo, meterNum = 4, meterDen = 4 } = options;

  // Group notes by voice
  const voices = new Map<string, MidiNote[]>();
  for (const n of notes) {
    const list = voices.get(n.voice) ?? [];
    list.push(n);
    voices.set(n.voice, list);
  }

  // Sort voices consistently
  const voiceOrder = ["melody", "counter", "bass", "arp", "pad", "perc", "drone"];
  const sortedVoices = [...voices.entries()].sort((a, b) => {
    const ai = voiceOrder.indexOf(a[0]);
    const bi = voiceOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const trackCount = 1 + sortedVoices.length; // conductor + voices

  // ── Conductor track ──
  const conductor: number[] = [];
  conductor.push(...encodeVLQ(0), ...trackNameEvent(title));
  conductor.push(...encodeVLQ(0), ...tempoEvent(tempo));
  conductor.push(...encodeVLQ(0), ...timeSigEvent(meterNum, meterDen));
  conductor.push(...encodeVLQ(0), ...endOfTrack());

  // ── Voice tracks ──
  const tracks: number[][] = [buildTrack(conductor)];

  for (let ch = 0; ch < sortedVoices.length; ch++) {
    const [voiceName, voiceNotes] = sortedVoices[ch];
    const channel = ch >= 9 ? ch + 1 : ch; // skip channel 9 (percussion)

    // Sort by beat
    voiceNotes.sort((a, b) => a.beat - b.beat);

    // Determine instrument from first note
    const instrument = voiceNotes[0]?.instrument ?? 0;

    const events: number[] = [];
    events.push(...encodeVLQ(0), ...trackNameEvent(voiceName));
    events.push(...encodeVLQ(0), ...programChange(channel, instrument));

    // Build note-on/note-off event list sorted by absolute tick
    interface MidiEvent { tick: number; data: number[] }
    const midiEvents: MidiEvent[] = [];

    for (const n of voiceNotes) {
      const onTick = Math.round(n.beat * TICKS_PER_QUARTER);
      const offTick = Math.round((n.beat + n.duration) * TICKS_PER_QUARTER);
      midiEvents.push({ tick: onTick, data: noteOn(channel, n.midi, n.velocity) });
      midiEvents.push({ tick: offTick, data: noteOff(channel, n.midi) });
    }

    // Sort by tick (note-offs before note-ons at same tick)
    midiEvents.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      // Note-off (0x80) before note-on (0x90) at same tick
      return (a.data[0] & 0xf0) - (b.data[0] & 0xf0);
    });

    // Convert to delta-time encoding
    let lastTick = 0;
    for (const evt of midiEvents) {
      const delta = evt.tick - lastTick;
      events.push(...encodeVLQ(delta), ...evt.data);
      lastTick = evt.tick;
    }

    events.push(...encodeVLQ(0), ...endOfTrack());
    tracks.push(buildTrack(events));
  }

  // ── File header ──
  const header: number[] = [];
  writeStr(header, "MThd");
  writeU32(header, 6); // header length
  writeU16(header, 1); // format 1
  writeU16(header, trackCount);
  writeU16(header, TICKS_PER_QUARTER);

  // Combine
  const file: number[] = [...header];
  for (const track of tracks) file.push(...track);
  return new Uint8Array(file);
}
