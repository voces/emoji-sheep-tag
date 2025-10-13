import { renderer } from "../graphics/three.ts";

export const isSoftwareRenderer = (): boolean => {
  if (!renderer) return false;

  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");

  if (!debugInfo) return false;

  const rendererInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return /swiftshader|llvmpipe|mesa|software|microsoft basic/i.test(
    rendererInfo,
  );
};
