import { isTauri } from "./isTauri.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { applyRawMouseDelta, mouse, setRawMouseActive } from "./mouse.ts";

// Drives the in-game cursor from raw, unaccelerated mouse deltas (Windows only,
// via the Rust WM_INPUT hook). While active the real OS cursor is ignored (it
// stays confined + CSS-hidden); we poll accumulated deltas each frame and move
// the simulated cursor (mouse.pixels) with sensitivity applied.
//
// Imported lazily by tauriBridge at lock time, so its static mouse.ts import
// doesn't force that module to initialize early (which crashes on startup).

let running = false;

const getWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

// With raw input the hidden real cursor diverges from the game cursor, so native
// clicks would land at the wrong place — redirect them to the simulated cursor.
const onClick = (e: MouseEvent) => {
  if (!e.isTrusted) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  const target = document.elementFromPoint(mouse.pixels.x, mouse.pixels.y);
  target?.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: mouse.pixels.x,
      clientY: mouse.pixels.y,
    }),
  );
};

const loop = async () => {
  while (running) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const [dx, dy] = await invoke<[number, number]>("take_raw_mouse_delta");
      if (dx || dy) applyRawMouseDelta(dx, dy);
    } catch { /* ignore */ }
    await new Promise(requestAnimationFrame);
  }
};

/**
 * Begin raw-delta cursor control. Returns false where unsupported (non-Windows
 * desktop), leaving the caller's confined-absolute cursor untouched.
 */
export const startRawMouse = async (): Promise<boolean> => {
  if (!isTauri || running) return running;
  // Off => keep the 1:1 confined-absolute cursor instead of raw deltas.
  if (!gameplaySettingsVar().rawMouseInput) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (!(await invoke<boolean>("start_raw_input"))) return false;
  } catch {
    return false;
  }
  running = true;
  setRawMouseActive(true);
  globalThis.addEventListener("click", onClick, { capture: true });
  loop();
  return true;
};

export const stopRawMouse = async () => {
  if (!running) return;
  running = false;
  setRawMouseActive(false);
  globalThis.removeEventListener("click", onClick, { capture: true });
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("stop_raw_input");
  } catch { /* ignore */ }
  // Continuity: drop the (hidden) OS cursor where the game cursor ended up, so
  // the absolute-position path resumes with no jump.
  try {
    const { LogicalPosition } = await import("@tauri-apps/api/dpi");
    const win = await getWindow();
    await win.setCursorPosition(
      new LogicalPosition(mouse.pixels.x, mouse.pixels.y),
    );
  } catch { /* ignore */ }
};
