/**
 * SF2 SoundFont player via FluidSynth WASM.
 * Handles loading the WASM module, soundfont, and playing notes.
 */

let JSSynth: any = null;
let synthInstance: any = null;
let isReady = false;
let loadPromise: Promise<void> | null = null;
let outputBus: AudioNode | null = null;

const SF2_PATH = "/GeneralUser-GS.sf2";
const GAIN = 0.4;

/** Route the SF2 ScriptProcessor through a host-provided AudioNode (e.g. a
 *  GainNode or master compressor). Must be called before `loadSF2`. If left
 *  unset, the synth connects directly to `AudioContext.destination`. */
export function setSF2OutputBus(node: AudioNode | null): void {
  outputBus = node;
}

// fluidsynth's wasm emits "function fluid_file_test/fluid_stat is a stub" on
// every sfload because its POSIX file-IO shims always succeed/fail. We feed
// the soundfont as an in-memory ArrayBuffer so those paths are never taken —
// the warnings are decorative. Filtering these via console.{log,error} works
// because emscripten routes wasm stderr through Module.printErr → console.
//
// We do NOT try to filter Chrome's "ScriptProcessorNode is deprecated"
// warning here. That report is emitted by Blink's deprecation reporter
// directly, bypassing console.* overrides — there's no JS-side hook for
// it. AudioWorkletNode would eliminate the warning at the source, but
// js-synthesizer's worklet path needs libfluidsynth-2.4.6.js to run
// inside AudioWorkletGlobalScope (which lacks the window/importScripts
// detection the emscripten loader uses), so the swap is non-trivial.
// The warning fires once at first-gesture init and is benign.
const FLUIDSYNTH_STUB = /fluidsynth: error: function fluid_(file_test|stat) is a stub/;

function isKnownNoise(msg: unknown): boolean {
  if (typeof msg !== "string") return false;
  return FLUIDSYNTH_STUB.test(msg);
}

/** Run `fn` with console.{log,warn,error} filtered to drop known-noise messages.
 *  Used around fluidsynth wasm calls and createScriptProcessor where we know
 *  the warnings are decorative. */
async function withNoiseFilter<T>(fn: () => T | Promise<T>): Promise<T> {
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const filt = (o: (m: any, ...rest: any[]) => void) =>
    (m: any, ...rest: any[]) => { if (!isKnownNoise(m)) o(m, ...rest); };
  console.log = filt(orig.log);
  console.warn = filt(orig.warn);
  console.error = filt(orig.error);
  try {
    return await fn();
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

/** Load the libfluidsynth WASM as a script tag and wait for initialization.
 *  Pre-sets `globalThis.Module` so emscripten routes its stub warnings through
 *  our filter rather than directly to console.error. */
function loadWasm(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((globalThis as any).Module?._fluid_synth_sfload) {
      resolve();
      return;
    }
    // Emscripten's printErr/print default to console.error/console.log;
    // overriding them here intercepts wasm-side stderr before it surfaces.
    const existing = (globalThis as any).Module || {};
    (globalThis as any).Module = {
      ...existing,
      printErr: (msg: string) => { if (!isKnownNoise(msg)) console.error(msg); },
      print:    (msg: string) => { if (!isKnownNoise(msg)) console.log(msg); },
    };
    const script = document.createElement("script");
    script.src = "/libfluidsynth-2.4.6.js";
    script.onload = () => {
      // Poll for WASM initialization
      const check = () => {
        if ((globalThis as any).Module?.calledRun) resolve();
        else setTimeout(check, 50);
      };
      check();
    };
    script.onerror = () => reject(new Error("Failed to load libfluidsynth"));
    document.head.appendChild(script);
  });
}

/** Load the SF2 soundfont. Safe to call multiple times — only loads once. */
export function loadSF2(ctx: AudioContext): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Step 1: Load WASM module
    await loadWasm();

    // Step 2: Import js-synthesizer (finds the global Module)
    const mod = await import("js-synthesizer");
    JSSynth = mod.default ?? mod;
    await JSSynth.waitForReady();

    // Step 3: Create synthesizer
    synthInstance = new JSSynth.Synthesizer();
    synthInstance.init(ctx.sampleRate);
    synthInstance.setGain(GAIN);

    // Step 4: Load SF2 file (filter wasm stub warnings).
    const response = await fetch(SF2_PATH);
    const sf2 = await response.arrayBuffer();
    await withNoiseFilter(() => synthInstance.loadSFont(sf2));

    // Step 5: Connect to Web Audio output via ScriptProcessor. Chrome emits
    // a one-time deprecation warning here that we cannot suppress from JS
    // (see isKnownNoise comment above for why).
    const node = ctx.createScriptProcessor(4096, 0, 2);
    node.onaudioprocess = (event: AudioProcessingEvent) => {
      if (synthInstance) synthInstance.render(event.outputBuffer);
    };
    node.connect(outputBus ?? ctx.destination);

    isReady = true;
  })();

  return loadPromise;
}

/** True when the soundfont is loaded and ready to play. */
export function isSF2Ready(): boolean {
  return isReady;
}

/** Play a note. Returns a stop function. */
export function noteOn(
  midi: number,
  program: number,
  velocity = 1.0,
  channel = 0,
): () => void {
  if (!isReady || !synthInstance) return () => {};

  const midiVel = Math.round(Math.max(1, Math.min(127, velocity * 127)));
  synthInstance.midiProgramChange(channel, program);
  synthInstance.midiNoteOn(channel, midi, midiVel);

  return () => {
    if (synthInstance) synthInstance.midiNoteOff(channel, midi);
  };
}

/** Stop all notes on all channels. */
export function allNotesOff(): void {
  if (!synthInstance) return;
  for (let ch = 0; ch < 16; ch++) {
    synthInstance.midiAllNotesOff(ch);
  }
}

/** Direct MIDI channel commands for MIDI file playback. */
export function midiProgramChange(channel: number, program: number): void {
  if (synthInstance) synthInstance.midiProgramChange(channel, program);
}

export function midiNoteOn(channel: number, midi: number, velocity: number): void {
  if (synthInstance) synthInstance.midiNoteOn(channel, midi, velocity);
}

export function midiNoteOff(channel: number, midi: number): void {
  if (synthInstance) synthInstance.midiNoteOff(channel, midi);
}

export function midiControlChange(channel: number, control: number, value: number): void {
  if (synthInstance) synthInstance.midiControlChange(channel, control, value);
}

export function midiPitchBend(channel: number, value: number): void {
  if (synthInstance) synthInstance.midiPitchBend(channel, value);
}
