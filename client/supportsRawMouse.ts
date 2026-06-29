import { isTauri } from "./isTauri.ts";

// Raw mouse input + sensitivity need relative motion. The browser provides it via
// pointer lock (any OS); on the desktop only Windows does (WM_INPUT). macOS/Linux
// Tauri fall back to a 1:1 absolute cursor where these settings do nothing, so we
// hide them there.
export const supportsRawMouse = !isTauri ||
  /windows/i.test(globalThis.navigator?.userAgent ?? "");
