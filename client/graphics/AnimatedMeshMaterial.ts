/**
 * AnimatedMeshMaterial - Custom material with GPU-driven animation shader.
 *
 * Two-pass rendering for "object opacity" (no internal part stacking):
 * 1. Depth pass: writes depth buffer with partID Z-offset for intra-instance occlusion
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
  WATER_SHADER_ENTITY_TINT,
  WATER_SHADER_ENTITY_VARYINGS,
  WATER_SHADER_ENTITY_VERTEX,
  WATER_SHADER_MOTION,
  WATER_SHADER_NOISE,
  WATER_SHADER_RIPPLES,
} from "./waterShader.ts";
import { waterRippleUniforms } from "./waterRipples.ts";

let animationTime = 0;

export const updateAnimationTime = (delta: number) => {
  animationTime += delta;
};

export const getAnimationTime = () => animationTime;

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

const PART_Z_OFFSET = 0.0001;

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

const addAnimationUniforms = (shader: WebGLProgramParametersWithUniforms) => {
  shader.uniforms.uTime = { value: 0 };
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

export const createAnimatedMeshMaterial = (): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: true,
    depthFunc: LessEqualDepth,
  });

  material.customProgramCacheKey = () => "animatedMesh";

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
        // instanceMinimapMask packs the minimap flag as a +4 offset on top of
        // submergence (stored as a float in [0, 4), not a quantized 0..1).
        vInstanceMinimapMask = instanceMinimapMask >= 4.0 ? 1.0 : 0.0;
        float submergence = instanceMinimapMask - vInstanceMinimapMask * 4.0;
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
          vAnimOpacity = mix(opacityA, opacityB, wB);

          vec3 posB = transformed * animB.a;
          float cosB = cos(animB.b);
          float sinB = sin(animB.b);
          posB = vec3(posB.x * cosB - posB.y * sinB, posB.x * sinB + posB.y * cosB, posB.z);
          posB.x += animB.r;
          posB.y += animB.g;

          transformed = mix(posA, posB, wB);
        } else {
          transformed = posA;
          vAnimOpacity = opacityA;
        }
      }
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
      #include <project_vertex>
      gl_Position.z -= partID * ${PART_Z_OFFSET};
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      /#include <color_vertex>/,
      `
      #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
        vColor = vec4( 1.0 );
      #endif
      #ifdef USE_COLOR
        vColor.rgb *= color;
      #endif

      if (vPlayerMask < 0.5) {
        vColor.rgb *= vTint;
      }

      if (vPlayerMask > 0.5) {
        vec3 srgb = mix(
          vColor.rgb * 12.92,
          pow(vColor.rgb, vec3(1.0 / 2.4)) * 1.055 - 0.055,
          step(0.0031308, vColor.rgb)
        );
        float lum = (srgb.r + srgb.g + srgb.b) / 3.0;
        if (lum < 0.5) {
          vColor.rgb = instancePlayerColor * (lum * 2.0);
        } else {
          vColor.rgb = mix(instancePlayerColor, vec3(1.0), (lum - 0.5) * 2.0);
        }
      }
      #ifdef USE_INSTANCING_COLOR
      else {
        vColor.rgb *= instanceColor.rgb;
      }
      #endif
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
      vec4 diffuseColor = vec4( diffuse, finalOpacity );
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      /#include <color_fragment>/,
      `
      #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
        diffuseColor *= vInstanceMinimapMask > 0.5 ? vec4(vPlayerColor, 1.0) : vColor;
      #endif
      ${WATER_SHADER_ENTITY_TINT}
      `,
    );
  };

  material.onBeforeRender = () => {
    const refs = shaderRefs.get(material);
    if (refs) {
      for (const shaderRef of refs) {
        shaderRef.uniforms.uTime.value = animationTime;
      }
    }
  };

  return material;
};

let sharedMaterial: MeshBasicMaterial | null = null;

export const getAnimatedMeshMaterial = (): MeshBasicMaterial =>
  sharedMaterial ?? (sharedMaterial = createAnimatedMeshMaterial());

export const createDepthMaterial = (): MeshBasicMaterial => {
  const material = new MeshBasicMaterial({
    colorWrite: false,
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
    depthTest: true,
  });

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
      {
        vec3 posA = transformed * animA.a;
        float cosA = cos(animA.b);
        float sinA = sin(animA.b);
        posA = vec3(posA.x * cosA - posA.y * sinA, posA.x * sinA + posA.y * cosA, posA.z);
        posA.x += animA.r;
        posA.y += animA.g;
        float animOpacity;

        if (wB > 0.001) {
          vec4 animBVal = sampleAnimation(partID, instanceAnimB.x, instanceAnimB.y, instanceAnimB.z);
          float opacityB = sampleOpacity(partID, instanceAnimB.x, instanceAnimB.y, instanceAnimB.z);
          animOpacity = mix(opacityA, opacityB, wB);

          vec3 posB = transformed * animBVal.a;
          float cosB = cos(animBVal.b);
          float sinB = sin(animBVal.b);
          posB = vec3(posB.x * cosB - posB.y * sinB, posB.x * sinB + posB.y * cosB, posB.z);
          posB.x += animBVal.r;
          posB.y += animBVal.g;

          transformed = mix(posA, posB, wB);
        } else {
          transformed = posA;
          animOpacity = opacityA;
        }
        vFinalOpacity = instanceAlpha * animOpacity;
        vInstanceAlpha = instanceAlpha;
      }
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `
      #include <project_vertex>
      gl_Position.z -= partID * ${PART_Z_OFFSET};
      `,
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

  material.onBeforeRender = () => {
    const refs = shaderRefs.get(material);
    if (refs) {
      for (const shaderRef of refs) {
        shaderRef.uniforms.uTime.value = animationTime;
      }
    }
  };

  return material;
};

let sharedDepthMaterial: MeshBasicMaterial | null = null;

export const getDepthMaterial = (): MeshBasicMaterial =>
  sharedDepthMaterial ?? (sharedDepthMaterial = createDepthMaterial());
