import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

const gameplaySettingsSchema = z.object({
  sheepZoom: z.number().min(1).max(50).catch(9),
  wolfZoom: z.number().min(1).max(50).catch(9),
  spiritZoom: z.number().min(1).max(50).catch(9),
  clearOrderOnRightClick: z.boolean().catch(true),
  showPing: z.boolean().catch(false),
  showFps: z.boolean().catch(false),
});

export type GameplaySettings = z.infer<typeof gameplaySettingsSchema>;

const GAMEPLAY_SETTINGS_KEY = "emoji-sheep-tag-gameplay-settings";

const getStoredSettings = (): GameplaySettings => {
  try {
    const stored = localStorage.getItem(GAMEPLAY_SETTINGS_KEY);
    if (stored) {
      return gameplaySettingsSchema.parse(JSON.parse(stored));
    }
  } catch {
    // Silently fail if localStorage is not available or invalid
  }
  return gameplaySettingsSchema.parse({});
};

const saveSettings = (settings: GameplaySettings): void => {
  try {
    localStorage.setItem(GAMEPLAY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail if localStorage is not available
  }
};

export const gameplaySettingsVar = makeVar<GameplaySettings>(
  getStoredSettings(),
);

// Subscribe to changes and persist to localStorage
gameplaySettingsVar.subscribe((settings) => {
  saveSettings(settings);
});
