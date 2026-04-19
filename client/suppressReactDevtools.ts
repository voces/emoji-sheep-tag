// Suppress "Download the React DevTools" console message in development.
// Must be imported before any React module loads.
// If the extension already defined this as a getter, skip gracefully.
try {
  Object.defineProperty(globalThis, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
    value: { isDisabled: true },
    writable: true,
    configurable: true,
  });
} catch { /* extension already installed — let it handle things */ }
