import { renderer } from "../graphics/three.ts";

/** The parts of a WebGL context asked for the renderer's name. */
type RendererQuery = {
  getExtension(
    name: "WEBGL_debug_renderer_info",
  ): { UNMASKED_RENDERER_WEBGL: number; UNMASKED_VENDOR_WEBGL: number } | null;
  getParameter(name: number): unknown;
};

export type GpuInfo = { renderer: string; vendor: string; software: boolean };

/**
 * What each context renders with. Asking a driver can stall until the GPU has
 * caught up with everything sent it, shaders compiling included, and the
 * answer cannot change while the context lives, so each context is asked once.
 */
const answers = new WeakMap<RendererQuery, GpuInfo | null>();

const SOFTWARE = /swiftshader|llvmpipe|mesa|software|microsoft basic/i;

const ask = (
  gl: RendererQuery,
  names: { UNMASKED_RENDERER_WEBGL: number; UNMASKED_VENDOR_WEBGL: number },
): GpuInfo => {
  const renderer = String(gl.getParameter(names.UNMASKED_RENDERER_WEBGL));
  return {
    renderer,
    vendor: String(gl.getParameter(names.UNMASKED_VENDOR_WEBGL)),
    software: SOFTWARE.test(renderer),
  };
};

export const gpuInfoOf = (gl: RendererQuery): GpuInfo | undefined => {
  let info = answers.get(gl);
  if (info === undefined) {
    const names = gl.getExtension("WEBGL_debug_renderer_info");
    info = names ? ask(gl, names) : null;
    answers.set(gl, info);
  }
  return info ?? undefined;
};

export const softwareRendererOf = (gl: RendererQuery): boolean =>
  gpuInfoOf(gl)?.software ?? false;

export const gpuInfo = (): GpuInfo | undefined =>
  renderer ? gpuInfoOf(renderer.getContext()) : undefined;

export const isSoftwareRenderer = (): boolean => gpuInfo()?.software ?? false;
