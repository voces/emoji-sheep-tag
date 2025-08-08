/**
 * Formats keyboard shortcuts for display, converting key codes to readable symbols
 * @param shortcut Array of key codes (e.g., ["ControlLeft", "KeyQ"])
 * @returns Formatted string (e.g., "⌃ + Q")
 */
export const formatShortcut = (shortcut: ReadonlyArray<string>) =>
  shortcut.map((v) =>
    v
      // Modifier keys with symbols
      .replace(/^Control(Left|Right)?$/, "⌃")
      .replace(/^Alt(Left|Right)?$/, "⌥")
      .replace(/^Shift(Left|Right)?$/, "⇧")
      .replace(/^Meta(Left|Right)?$/, "⌘")
      // Special keys
      .replace("Slash", "/")
      .replace("Backslash", "\\")
      .replace("Comma", ",")
      .replace("Period", ".")
      .replace("Semicolon", ";")
      .replace("Quote", "'")
      .replace("BracketLeft", "[")
      .replace("BracketRight", "]")
      .replace("Backquote", "`")
      .replace("Minus", "-")
      .replace("Equal", "=")
      .replace("Enter", "↵")
      .replace("Tab", "⇥")
      .replace("Space", "␣")
      .replace("Escape", "⎋")
      .replace("Backspace", "⌫")
      .replace("Delete", "⌦")
      .replace("CapsLock", "⇪")
      // Arrow keys
      .replace("ArrowUp", "↑")
      .replace("ArrowDown", "↓")
      .replace("ArrowLeft", "←")
      .replace("ArrowRight", "→")
      // Function keys
      .replace(/^F(\d+)$/, "F$1")
      // Page navigation
      .replace("PageUp", "⇞")
      .replace("PageDown", "⇟")
      .replace("Home", "⇱")
      .replace("End", "⇲")
      // Remove prefixes
      .replace(/^Key/, "")
      .replace(/^Digit/, "")
      .replace(/^Numpad/, "#")
  ).join(" + ");
