/**
 * AnimatedMeshMaterial - Custom material with GPU-driven animation shader.
 *
 * Opaque instances draw in one pass that writes depth, sorted with every other
 * sprite. See-through instances draw after all opaque sprites, in two passes for
 * "object opacity" (no internal part stacking):
 * 1. Depth pass: writes depth with a partID offset for intra-instance occlusion
 * 2. Color pass: tests against depth, renders with instance opacity
 */

import {
  DoubleSide,
  LessEqualDepth,
  Material,
  MeshBasicMaterial,
  WebGLProgramParametersWithUniforms,
} from "three";
import {
  WATER_SHADER_CAUSTICS,
  WATER_SHADER_CONSTANTS,
  WATER_SHADER_ENTITY_VARYINGS,
  WATER_SHADER_ENTITY_VERTEX,
  WATER_SHADER_MOTION,
  WATER_SHADER_NOISE,
  WATER_SHADER_RIPPLES,
} from "./waterShader.ts";
import { waterRippleUniforms } from "./waterRipples.ts";
import {
  SPRITE_COLOR_FRAGMENT,
  SPRITE_MINIMAP_MASK_DECODE,
  SPRITE_PLAYER_COLOR_BLEND,
  SPRITE_VERTEX_COLOR_INIT,
} from "./spriteShaderChunks.ts";
import {
  PART_DEPTH_GLSL,
  SORTED_PROJECT_VERTEX,
  SPRITE_PASS_DEFINES,
  SPRITE_PASS_DISCARD,
  spriteMaterialOptions,
  SpritePass,
} from "./depthSort.ts";

/** Shared by every sprite shader, so advancing it once animates them all. */
export const animationTimeUniform = { value: 0 };

export const updateAnimationTime = (delta: number) => {
  animationTimeUniform.value += delta;
};

export const getAnimationTime = () => animationTimeUniform.value;

const shaderRefs = new WeakMap<
  Material,
  WebGLProgramParametersWithUniforms[]
>();
const shaderReadyCallbacks = new Map<Material, () => void>();

export const getShaderRefs = (
  material: Material,
): WebGLProgramParametersWithUniforms[] => shaderRefs.get(material) ?? [];

export const onShaderReady = (material: Material, callback: () => void) => {
  if (shaderRefs.has(material)) {
    callback();
  } else {
    shaderReadyCallbacks.set(material, callback);
  }
};

const PROJECT_VERTEX = `
  #if SPRITE_PASS == 2
    #include <project_vertex>
  #else
    ${SORTED_PROJECT_VERTEX}
  #endif
  ${PART_DEPTH_GLSL}
`;

const VERTEX_ATTRIBUTES = `
  attribute vec2 partInfo;
  attribute float playerMask;
  attribute float instanceAlpha;
  attribute float instanceMinimapMask;
  attribute vec3 instancePlayerColor;
  attribute vec3 instanceTint;
  attribute vec4 instanceAnim;
  attribute vec4 instanceAnimB;

  uniform float uTime;
  uniform sampler2D uTransformTex;
  uniform sampler2D uOpacityTex;
  uniform float uSampleCount;
  uniform float uPartCount;
  uniform float uClipCount;
`;

const ANIMATION_FUNCTIONS = `
  float animTime(float phase, float speed) {
    float rawT = uTime * abs(speed) + phase;
    return speed < 0.0 ? clamp(rawT, 0.0, 0.9999) : fract(rawT);
  }

  vec4 sampleAnimation(float partId, float clip, float phase, float speed) {
    if (uPartCount <= 0.0 || uSampleCount <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
    float t = animTime(phase, speed);
    float u = (t * (uSampleCount - 1.0) + 0.5) / uSampleCount;
    float textureHeight = uPartCount * uClipCount;
    float v = (clip * uPartCount + partId + 0.5) / textureHeight;
    return texture2D(uTransformTex, vec2(u, v));
  }

  float sampleOpacity(float partId, float clip, float phase, float speed) {
    if (uPartCount <= 0.0 || uSampleCount <= 0.0) return 1.0;
    float t = animTime(phase, speed);
    float u = (t * (uSampleCount - 1.0) + 0.5) / uSampleCount;
    float textureHeight = uPartCount * uClipCount;
    float v = (clip * uPartCount + partId + 0.5) / textureHeight;
    return texture2D(uOpacityTex, vec2(u, v)).r;
  }
`;

/**
 * Moves `transformed` by the instance's animation, blending clip A into clip B
 * by `instanceAnimB.w`, and writes the blended part opacity to `opacityOut`.
 */
const animateTransformed = (opacityOut: string) => `
  {
    vec3 posA = transformed * animA.a;
    float cosA = cos(animA.b);
    float sinA = sin(animA.b);
    posA = vec3(posA.x * cosA - posA.y * sinA, posA.x * sinA + posA.y * cosA, posA.z);
    posA.x += animA.r;
    posA.y += animA.g;

    if (wB > 0.001) {
      vec4 animB = sampleAnimation(partID, instanceAnimB.x, instanceAnimB.y, instanceAnimB.z);
      float opacityB = sampleOpacity(partID, instanceAnimB.x, instanceAnimB.y, instanceAnimB.z);
      ${opacityOut} = mix(opacityA, opacityB, wB);

      vec3 posB = transformed * animB.a;
      float cosB = cos(animB.b);
      float sinB = sin(animB.b);
      posB = vec3(posB.x * cosB - posB.y * sinB, posB.x * sinB + posB.y * cosB, posB.z);
      posB.x += animB.r;
      posB.y += animB.g;

      transformed = mix(posA, posB, wB);
    } else {
      transformed = posA;
      ${opacityOut} = opacityA;
    }
  }
`;

const addAnimationUniforms = (shader: WebGLProgramParametersWithUniforms) => {
  shader.uniforms.uTime = animationTimeUniform;
  shader.uniforms.uTransformTex = { value: null };
  shader.uniforms.uOpacityTex = { value: null };
  shader.uniforms.uSampleCount = { value: 1 };
  shader.uniforms.uPartCount = { value: 0 };
  shader.uniforms.uClipCount = { value: 1 };
};

const addWaterRippleUniforms = (shader: WebGLProgramParametersWithUniforms) => {
  shader.uniforms.waterRippleCount = waterRippleUniforms.waterRippleCount;
  shader.uniforms.waterRipples = waterRippleUniforms.waterRipples;
};

export const createAnimatedMeshMaterial = (
  pass: SpritePass = "opaque",
): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    depthFunc: LessEqualDepth,
    ...spriteMaterialOptions(pass),
  });
  material.defines = { SPRITE_PASS: SPRITE_PASS_DEFINES[pass] };

  material.customProgramCacheKey = () => `animatedMesh-${pass}`;

  material.onBeforeCompile = (shader) => {
    const existing = shaderRefs.get(material);
    // Store all shaders in an array - Three.js may call onBeforeCompile multiple times
    // with different shader objects (for different render targets/cameras)
    if (!existing) {
      shaderRefs.set(material, [shader]);
      const callback = shaderReadyCallbacks.get(material);
      if (callback) {
        shaderReadyCallbacks.delete(material);
        callback();
      }
    } else if (!existing.includes(shader)) existing.push(shader);
    addAnimationUniforms(shader);
    addWaterRippleUniforms(shader);

    shader.vertexShader = `
      ${VERTEX_ATTRIBUTES}
      ${WATER_SHADER_MOTION}
      ${WATER_SHADER_ENTITY_VARYINGS}
      varying float vInstanceAlpha;
      varying float vInstanceMinimapMask;
      varying float vPlayerMask;
      varying vec3 vPlayerColor;
      varying vec3 vTint;
      varying float vAnimOpacity;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `
      ${ANIMATION_FUNCTIONS}
      void main() {
        float partID = partInfo.x;
        vInstanceAlpha = instanceAlpha;
        ${SPRITE_MINIMAP_MASK_DECODE}
        vPlayerMask = playerMask;
        vPlayerColor = instancePlayerColor;
        vTint = instanceTint;
        ${WATER_SHADER_ENTITY_VERTEX}
        vWaterline = partInfo.y - submergence - waterWaveOffset_;

        vec4 animA = sampleAnimation(partID, instanceAnim.x, instanceAnim.y, instanceAnim.z);
        float opacityA = sampleOpacity(partID, instanceAnim.x, instanceAnim.y, instanceAnim.z);
        float wB = instanceAnimB.w;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      ${animateTransformed("vAnimOpacity")}
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      PROJECT_VERTEX,
    );

    shader.vertexShader = shader.vertexShader.replace(
      /#include <color_vertex>/,
      `
      ${SPRITE_VERTEX_COLOR_INIT}
      if (vPlayerMask < 0.5) {
        vColor.rgb *= vTint;
      }
      ${SPRITE_PLAYER_COLOR_BLEND}
      `,
    );

    shader.fragmentShader = `
      ${WATER_SHADER_CONSTANTS}
      ${WATER_SHADER_NOISE}
      ${WATER_SHADER_CAUSTICS}
      ${WATER_SHADER_RIPPLES}
      ${WATER_SHADER_ENTITY_VARYINGS}
      uniform float uTime;
      varying float vInstanceAlpha;
      varying float vInstanceMinimapMask;
      varying float vPlayerMask;
      varying vec3 vPlayerColor;
      varying vec3 vTint;
      varying float vAnimOpacity;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      /vec4 diffuseColor = vec4\( diffuse, opacity \);/,
      `
      float finalOpacity = vInstanceAlpha * vAnimOpacity;
      ${SPRITE_PASS_DISCARD}
      vec4 diffuseColor = vec4( diffuse, finalOpacity );
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      /#include <color_fragment>/,
      SPRITE_COLOR_FRAGMENT,
    );
  };

  return material;
};

export const createDepthMaterial = (): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    colorWrite: false,
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
    depthTest: true,
  });
  material.defines = { SPRITE_PASS: SPRITE_PASS_DEFINES.translucent };

  material.customProgramCacheKey = () => "animatedMeshDepth";

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    const existing = shaderRefs.get(material);
    if (!existing) shaderRefs.set(material, [shader]);
    else if (!existing.includes(shader)) existing.push(shader);
    addAnimationUniforms(shader);

    shader.vertexShader = `
      ${VERTEX_ATTRIBUTES}
      varying float vFinalOpacity;
      varying float vInstanceAlpha;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      "void main() {",
      `
      ${ANIMATION_FUNCTIONS}
      void main() {
        float partID = partInfo.x;
        vec4 animA = sampleAnimation(partID, instanceAnim.x, instanceAnim.y, instanceAnim.z);
        float opacityA = sampleOpacity(partID, instanceAnim.x, instanceAnim.y, instanceAnim.z);
        float wB = instanceAnimB.w;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      float animOpacity;
      ${animateTransformed("animOpacity")}
      vFinalOpacity = instanceAlpha * animOpacity;
      vInstanceAlpha = instanceAlpha;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      PROJECT_VERTEX,
    );

    shader.fragmentShader = `
      varying float vFinalOpacity;
      varying float vInstanceAlpha;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
      void main() {
        // Only write depth for transparent instances (instanceAlpha < 1)
        // Opaque instances don't need depth pre-pass
        if (vInstanceAlpha >= 1.0) discard;
        if (vFinalOpacity < 0.01) discard;
      `,
    );
  };

  return material;
};

let sharedDepthMaterial: MeshBasicMaterial | null = null;

export const getDepthMaterial = (): MeshBasicMaterial =>
  sharedDepthMaterial ?? (sharedDepthMaterial = createDepthMaterial());
