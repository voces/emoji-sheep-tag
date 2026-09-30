import { isTauri } from "../isTauri.ts";
import { stateVar } from "@/vars/state.ts";
import { gameplaySettingsVar } from "@/vars/gameplaySettings.ts";
import { isSoftwareRenderer } from "../util/gpu.ts";
import { cancelBlueprint } from "./blueprintHandlers.ts";

// Pointer lock
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) cancelBlueprint();
});

// Cursor lock is scoped to an active round in Tauri: release it when the round
// ends. (The browser keeps its own pointer-lock lifecycle untouched.)
stateVar.subscribe((state) => {
  if (isTauri && state !== "playing" && document.pointerLockElement) {
    document.exitPointerLock();
  }
});

for (const event of ["pointerdown", "keydown", "contextmenu"]) {
  globalThis.document.body.addEventListener(event, async () => {
    if (
      !document.pointerLockElement &&
      gameplaySettingsVar().pointerLock === "always" &&
      // Round-scoped locking is a Tauri-only behavior; the browser keeps its
      // existing gesture-driven lock so we don't churn enter/exit there.
      (!isTauri || stateVar() === "playing") &&
      !isSoftwareRenderer()
    ) {
      try {
        // Ensure body has focus before requesting pointer lock
        // This fixes scrolling issues when entering via keyboard
        if (event === "keydown" && document.activeElement !== document.body) {
          document.body.focus();
        }

        await globalThis.document.body.requestPointerLock({
          unadjustedMovement: gameplaySettingsVar().rawMouseInput,
        });
      } catch { /* do nothing */ }
    }
  });
}

// Re-request pointer lock when rawMouseInput changes; release when pointerLock set to "never"
let lastRawMouseInput = gameplaySettingsVar().rawMouseInput;
let lastPointerLock = gameplaySettingsVar().pointerLock;
gameplaySettingsVar.subscribe(async (settings) => {
  if (settings.pointerLock !== lastPointerLock) {
    lastPointerLock = settings.pointerLock;
    if (settings.pointerLock === "never" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  if (settings.rawMouseInput !== lastRawMouseInput) {
    lastRawMouseInput = settings.rawMouseInput;
    if (!isTauri && document.pointerLockElement) {
      // Browser: re-request pointer lock to apply unadjustedMovement.
      document.exitPointerLock();
      try {
        await globalThis.document.body.requestPointerLock({
          unadjustedMovement: settings.rawMouseInput,
        });
      } catch { /* do nothing */ }
    } else if (isTauri && document.pointerLockElement) {
      // Desktop: switch live between raw WM_INPUT deltas and the 1:1 cursor.
      const m = await import("../rawMouse.ts");
      if (settings.rawMouseInput) m.startRawMouse();
      else m.stopRawMouse();
    }
  }
});
