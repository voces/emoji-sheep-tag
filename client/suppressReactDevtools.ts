// Suppress "Download the React DevTools" console message in development.
// Must be imported before any React module loads.
// deno-lint-ignore no-explicit-any
(globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
