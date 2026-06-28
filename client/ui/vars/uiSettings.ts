import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

export const displayModes = ["windowed", "borderless", "fullscreen"] as const;
export type DisplayMode = (typeof displayModes)[number];

const uiSettingsSchema = z.object({
  preferredActionsPerRow: z.number().min(0).max(8).catch(4),
  showPing: z.boolean().catch(false),
  showFps: z.boolean().catch(false),
  disableMessaging: z.boolean().catch(false),
  // Desktop (Tauri) only; ignored in the browser.
  displayMode: z.enum(displayModes).catch("windowed"),
});

export type UiSettings = z.infer<typeof uiSettingsSchema>;

const UI_SETTINGS_KEY = "emoji-sheep-tag-ui-settings";

const getStoredUiSettings = (): UiSettings => {
  try {
    const stored = localStorage.getItem(UI_SETTINGS_KEY);
    if (stored) {
      return uiSettingsSchema.parse(JSON.parse(stored));
    }
  } catch {
    // Fall through to default
  }
  return uiSettingsSchema.parse({});
};

export const uiSettingsVar = makeVar<UiSettings>(
  getStoredUiSettings(),
);

// Subscribe to changes to update localStorage
uiSettingsVar.subscribe((settings: UiSettings) => {
  // Store in localStorage
  try {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Silently fail if localStorage is not available
  }
});
