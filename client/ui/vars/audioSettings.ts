import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

const audioSettingsSchema = z.object({
  master: z.number().min(0).max(1).catch(1),
  sfx: z.number().min(0).max(1).catch(1),
  ui: z.number().min(0).max(1).catch(1),
  ambience: z.number().min(0).max(1).catch(1),
  music: z.number().min(0).max(1).catch(1),
});

export type AudioSettings = z.infer<typeof audioSettingsSchema>;

const AUDIO_SETTINGS_KEY = "emoji-sheep-tag-audio-settings";

/**
 * Per-channel ceiling when the slider reads 100%. Re-maps the user-facing
 * "100%" so each channel sits at a perceptually reasonable level instead of
 * unity. Headroom for the bus compressor lives here, not in raw call-site
 * volumes.
 */
const CHANNEL_MIX = {
  master: 0.85,
  sfx: 0.7,
  ui: 0.7,
  ambience: 1.0,
  music: 0.7,
} as const;

const getStoredAudioSettings = (): AudioSettings => {
  try {
    const stored = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (stored) {
      return audioSettingsSchema.parse(JSON.parse(stored));
    }
  } catch {
    // Fall through to default
  }
  return audioSettingsSchema.parse({});
};

export const audioSettingsVar = makeVar<AudioSettings>(
  getStoredAudioSettings(),
);

const setGains = (settings: AudioSettings) => {
  import("../../graphics/three.ts").then(({ channels }) => {
    if (channels.master) {
      channels.master.gain.value = settings.master * CHANNEL_MIX.master;
    }
    if (channels.sfx) channels.sfx.gain.value = settings.sfx * CHANNEL_MIX.sfx;
    if (channels.ui) channels.ui.gain.value = settings.ui * CHANNEL_MIX.ui;
    if (channels.ambience) {
      channels.ambience.gain.value = settings.ambience * CHANNEL_MIX.ambience;
    }
    if (channels.music) {
      channels.music.gain.value = settings.music * CHANNEL_MIX.music;
    }
  });
};

setGains(audioSettingsVar());

// Subscribe to changes to update gain nodes and localStorage
audioSettingsVar.subscribe((settings: AudioSettings) => {
  setGains(settings);

  // Store in localStorage
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail if localStorage is not available
  }
});
