const platform = typeof navigator !== "undefined"
  ? (navigator.platform ?? "")
  : "";
const isMac = /Mac|iPhone|iPad|iPod/.test(platform);
const isLinux = /Linux/.test(platform);

const formatKey = (v: string, verbose: boolean) =>
  v
    .replace(
      /^Control(Left|Right)?$/,
      verbose ? (isMac ? "Control" : "Ctrl") : (isMac ? "⌃" : "Ctrl"),
    )
    .replace(
      /^Alt(Left|Right)?$/,
      verbose ? (isMac ? "Option" : "Alt") : (isMac ? "⌥" : "Alt"),
    )
    .replace(/^Shift(Left|Right)?$/, verbose ? "Shift" : "⇧")
    .replace(
      /^Meta(Left|Right)?$/,
      isMac ? (verbose ? "Command" : "⌘") : isLinux ? "Super" : "Win",
    )
    .replace("Slash", "/")
    .replace("Backslash", "\\")
    .replace("Comma", ",")
    .replace("Period", ".")
    .replace("Semicolon", ";")
    .replace("Quote", "'")
    .replace("BracketLeft", "[")
    .replace("BracketRight", "]")
    .replace("Backquote", verbose ? "Backtick" : "`")
    .replace("Minus", "-")
    .replace("Equal", "=")
    .replace("Enter", verbose ? "Enter" : "↵")
    .replace("Tab", verbose ? "Tab" : "⇥")
    .replace("Space", verbose ? "Space" : "␣")
    .replace("Escape", verbose ? "Escape" : "⎋")
    .replace("Backspace", verbose ? "Backspace" : "⌫")
    .replace("Delete", verbose ? "Delete" : "⌦")
    .replace("CapsLock", verbose ? "Caps Lock" : "⇪")
    .replace("ArrowUp", verbose ? "Up" : "↑")
    .replace("ArrowDown", verbose ? "Down" : "↓")
    .replace("ArrowLeft", verbose ? "Left" : "←")
    .replace("ArrowRight", verbose ? "Right" : "→")
    .replace(/^F(\d+)$/, "F$1")
    .replace("PageUp", verbose ? "Page Up" : "⇞")
    .replace("PageDown", verbose ? "Page Down" : "⇟")
    .replace("Home", verbose ? "Home" : "⇱")
    .replace("End", verbose ? "End" : "⇲")
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Numpad/, verbose ? "Numpad " : "#");

export const formatShortcut = (shortcut: ReadonlyArray<string>) =>
  shortcut.map((v) => formatKey(v, false)).join(" + ");

export const formatShortcutVerbose = (shortcut: ReadonlyArray<string>) =>
  shortcut.map((v) => formatKey(v, true)).join(" + ");
