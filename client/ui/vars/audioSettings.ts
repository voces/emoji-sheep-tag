import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

const audioSettingsSchema = z.object({
  master: z.number().min(0).max(1).catch(1),
  sfx: z.number().min(0).max(1).catch(1),
  ui: z.number().min(0).max(1).catch(1),
  ambience: z.number().min(0).max(1).catch(1),
});

export type AudioSettings = z.infer<typeof audioSettingsSchema>;

const AUDIO_SETTINGS_KEY = "emoji-sheep-tag-audio-settings";

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
  // Update gain nodes when available
  import("../../graphics/three.ts").then(({ channels }) => {
    if (channels.master) channels.master.gain.value = settings.master;
    if (channels.sfx) channels.sfx.gain.value = settings.sfx;
    if (channels.ui) channels.ui.gain.value = settings.ui;
    if (channels.ambience) channels.ambience.gain.value = settings.ambience;
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
