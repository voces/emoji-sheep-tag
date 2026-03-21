import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

export const presets = ["est", "wc3"] as const;
export type Preset = typeof presets[number];

const shortcutSettingsSchema = z.object({
  useSlotBindings: z.boolean().catch(false),
  preset: z.enum(presets).catch("est"),
});

export type ShortcutSettings = z.infer<typeof shortcutSettingsSchema>;

const STORAGE_KEY = "emoji-sheep-tag-shortcut-settings";

const load = (): ShortcutSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return shortcutSettingsSchema.parse(JSON.parse(stored));
  } catch { /* fall through */ }
  return shortcutSettingsSchema.parse({});
};

export const shortcutSettingsVar = makeVar<ShortcutSettings>(load());

shortcutSettingsVar.subscribe((settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
});
