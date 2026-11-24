/**
 * Whether there is no WebGL to render with, as when tests run under jsdom.
 * Rendering and the editor's scene overlays are skipped when headless.
 */
export const headless = typeof WebGLRenderingContext === "undefined";
