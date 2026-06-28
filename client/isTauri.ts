// Tauri v2 injects __TAURI_INTERNALS__ into the webview regardless of platform.
// (location.hostname is "tauri.localhost" only on Windows; Linux/macOS use the
// tauri://localhost protocol, where the hostname is just "localhost".)
export const isTauri = "__TAURI_INTERNALS__" in globalThis;
