import { isTauri } from "./isTauri.ts";
import { resyncPointerLock } from "./tauriBridge.ts";
import { type DisplayMode, uiSettingsVar } from "@/vars/uiSettings.ts";

const getWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

/**
 * Apply a display mode to the native window. No-op in the browser.
 * - windowed: decorated, resizable window
 * - borderless: borderless window maximized to fill the screen
 * - fullscreen: (borderless) fullscreen via the platform window manager
 */
export const applyDisplayMode = async (mode: DisplayMode) => {
  if (!isTauri) return;
  try {
    const win = await getWindow();
    if (mode === "fullscreen") {
      await win.setFullscreen(true);
    } else {
      await win.setFullscreen(false);
      if (mode === "borderless") {
        await win.setDecorations(false);
        await win.maximize();
      } else {
        await win.unmaximize();
        await win.setDecorations(true);
      }
    }
    // The window transition drops the OS cursor grab; restore it if locked.
    await resyncPointerLock();
  } catch (e) {
    console.error("[displayMode] applyDisplayMode failed:", e);
  }
};

/**
 * Toggle fullscreen. In Tauri this drives the displayMode setting (so the
 * Settings UI stays in sync); in the browser it uses the Fullscreen API.
 */
export const toggleFullscreen = async () => {
  if (!isTauri) {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    return;
  }
  const settings = uiSettingsVar();
  uiSettingsVar({
    ...settings,
    displayMode: settings.displayMode === "fullscreen"
      ? "windowed"
      : "fullscreen",
  });
};

if (isTauri) {
  let current = uiSettingsVar().displayMode;
  applyDisplayMode(current);
  uiSettingsVar.subscribe((settings) => {
    if (settings.displayMode === current) return;
    current = settings.displayMode;
    applyDisplayMode(current);
  });
}
