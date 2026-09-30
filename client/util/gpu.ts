import { renderer } from "../graphics/three.ts";

/** The parts of a WebGL context asked for the renderer's name. */
type RendererQuery = {
  getExtension(
    name: "WEBGL_debug_renderer_info",
  ): { UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter(name: number): unknown;
};

/**
 * Whether each context renders in software. Asking a driver for its renderer
 * can stall a frame, and the answer cannot change while the context lives, so
 * each context is asked once.
 */
const answers = new WeakMap<RendererQuery, boolean>();

export const softwareRendererOf = (gl: RendererQuery): boolean => {
  const known = answers.get(gl);
  if (known !== undefined) return known;
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const software = !!debugInfo &&
    /swiftshader|llvmpipe|mesa|software|microsoft basic/i.test(
      String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
    );
  answers.set(gl, software);
  return software;
};

export const isSoftwareRenderer = (): boolean =>
  !!renderer && softwareRendererOf(renderer.getContext());
