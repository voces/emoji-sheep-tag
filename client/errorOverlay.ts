// Debug aid: the React UI renders into a separate layer, so when it crashes the
// screen can go blank with no clue why (especially in Tauri, where there's no
// console in a release build). This paints uncaught errors straight onto the DOM
// so they're visible — and screenshottable — even with a dead React tree.
import { isTauri } from "./isTauri.ts";

let box: HTMLDivElement | undefined;
let count = 0;
const MAX = 50;

const ensureBox = (): HTMLDivElement => {
  if (box) return box;
  box = document.createElement("div");
  box.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "top:0",
    "z-index:2147483647",
    "max-height:60vh",
    "overflow:auto",
    "background:rgba(50,0,0,0.94)",
    "color:#fff",
    "font:12px/1.45 monospace",
    "padding:8px 10px",
    "white-space:pre-wrap",
    "border-bottom:2px solid #ff5252",
  ].join(";");
  (document.body ?? document.documentElement).appendChild(box);
  return box;
};

// Forward to the Tauri process so errors land in the terminal too.
const forward = (text: string) => {
  if (!isTauri) return;
  import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke("log_error", { message: text }))
    .catch(() => {});
};

// `paint` is false for console.error (forwarded to the terminal but not drawn
// on-screen, to avoid covering the game with benign logs); uncaught errors and
// rejections paint, since those are what blank the UI.
const report = (label: string, detail: string, paint = true) => {
  forward(`${label}: ${detail}`);
  if (!paint || count++ > MAX) return;
  const line = document.createElement("div");
  line.textContent = `[${label}] ${detail}`;
  ensureBox().appendChild(line);
};

const describe = (value: unknown): string => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

globalThis.addEventListener("error", (e) => {
  report("error", e.error ? describe(e.error) : e.message);
});

globalThis.addEventListener("unhandledrejection", (e) => {
  report("unhandledrejection", describe(e.reason));
});

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  originalError(...args);
  report("console.error", args.map(describe).join(" "), false);
};
