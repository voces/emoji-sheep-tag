import { makeVar } from "@/hooks/useVar.tsx";

export type AudioSettings = {
  master: number;
  sfx: number;
  ui: number;
  ambience: number;
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  sfx: 1,
  ui: 1,
  ambience: 1,
};

const AUDIO_SETTINGS_KEY = "emoji-sheep-tag-audio-settings";

const getStoredAudioSettings = (): AudioSettings => {
  try {
    const stored = localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate that all required keys exist
      if (
        typeof parsed === "object" &&
        typeof parsed.master === "number" &&
        typeof parsed.sfx === "number" &&
        typeof parsed.ui === "number" &&
        typeof parsed.ambience === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_AUDIO_SETTINGS;
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
