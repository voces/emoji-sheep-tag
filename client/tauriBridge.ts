import { isTauri } from "./isTauri.ts";

let locked: Element | null = null;

const getWindow = async () => {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
};

/**
 * Re-confine the cursor after a window change (display mode / fullscreen toggle),
 * which the OS drops on the transition. No-op unless pointer-locked.
 */
export const resyncPointerLock = async () => {
  if (!isTauri || !locked) return;
  try {
    const win = await getWindow();
    await win.setCursorGrab(false);
    await win.setCursorGrab(true);
  } catch (e) {
    console.error("[tauriBridge] resyncPointerLock failed:", e);
  }
};

if (isTauri) {
  // Hide the OS cursor app-wide and draw our own (mouse.pixels) instead. We do
  // NOT use setCursorVisible(false): on Windows a hidden + confined cursor stops
  // emitting pointermove events (winit #3987). Hiding via CSS keeps events
  // flowing while the cursor stays invisible.
  const hideCursorStyle = document.createElement("style");
  hideCursorStyle.textContent = "* { cursor: none !important; }";
  document.head.appendChild(hideCursorStyle);

  // Confine the cursor to the window. The real cursor stays visible to the OS
  // (events keep flowing) and its absolute position drives the game cursor, so
  // at a window edge it simply rests there and powers edge-panning — no relative
  // deltas, no cursor warping, no phantom walls.
  const grab = async () => {
    try {
      const win = await getWindow();
      await win.setCursorGrab(true);
    } catch (e) {
      console.error("[tauriBridge] grab failed:", e);
    }
  };

  const release = async () => {
    try {
      const win = await getWindow();
      await win.setCursorGrab(false);
    } catch (e) {
      console.error("[tauriBridge] release failed:", e);
    }
  };

  // Confinement is scoped to a round via controls.ts calling requestPointerLock.
  // Imported lazily so its mouse.ts dependency doesn't initialize at startup.
  const setRaw = (on: boolean) => {
    import("./rawMouse.ts").then((m) => {
      if (on) m.startRawMouse();
      else m.stopRawMouse();
    });
  };

  Element.prototype.requestPointerLock = async function () {
    locked = this;
    await grab();
    setRaw(true);
    document.dispatchEvent(new Event("pointerlockchange"));
  };

  document.exitPointerLock = () => {
    locked = null;
    setRaw(false);
    release();
    document.dispatchEvent(new Event("pointerlockchange"));
  };

  Object.defineProperty(document, "pointerLockElement", {
    get: () => locked,
    configurable: true,
  });

  globalThis.addEventListener("blur", () => {
    if (!locked) return;
    locked = null;
    setRaw(false);
    release();
    document.dispatchEvent(new Event("pointerlockchange"));
  });

  // Suppress the webview's default Alt handling while pointer-locked. Fullscreen
  // hotkeys are handled centrally in controls.ts via toggleFullscreen().
  document.addEventListener("keydown", (e) => {
    if (e.key === "Alt" && locked) e.preventDefault();
  });
}
