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

let animationTime = 0;

export const updateAnimationTime = (time: number) => {
  animationTime = time;
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
  attribute float partID;
  attribute float playerMask;
  attribute float instanceAlpha;
  attribute float instanceMinimapMask;
  attribute vec3 instancePlayerColor;
  attribute vec3 instanceTint;
  attribute vec3 instanceAnim;

  uniform float uTime;
  uniform sampler2D uTransformTex;
  uniform sampler2D uOpacityTex;
  uniform float uSampleCount;
  uniform float uPartCount;
  uniform float uClipCount;
`;

const ANIMATION_FUNCTIONS = `
  vec4 sampleAnimation(float partId, float clip, float phase, float speed) {
    if (uPartCount <= 0.0 || uSampleCount <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
    float t = fract(uTime * speed + phase);
    float u = (t * (uSampleCount - 1.0) + 0.5) / uSampleCount;
    float textureHeight = uPartCount * uClipCount;
    float v = (clip * uPartCount + partId + 0.5) / textureHeight;
    return texture2D(uTransformTex, vec2(u, v));
  }

  float sampleOpacity(float partId, float clip, float phase, float speed) {
    if (uPartCount <= 0.0 || uSampleCount <= 0.0) return 1.0;
    float t = fract(uTime * speed + phase);
    float u = (t * (uSampleCount - 1.0) + 0.5) / uSampleCount;
    float textureHeight = uPartCount * uClipCount;
    float v = (clip * uPartCount + partId + 0.5) / textureHeight;
    return texture2D(uOpacityTex, vec2(u, v)).r;
  }
`;

const TRANSFORM_VERTEX = `
  #include <begin_vertex>
  transformed *= scale;
  float cosR = cos(rot);
  float sinR = sin(rot);
  transformed = vec3(
    transformed.x * cosR - transformed.y * sinR,
    transformed.x * sinR + transformed.y * cosR,
    transformed.z
  );
  transformed.x += tx;
  transformed.y += ty;
`;

const addAnimationUniforms = (shader: WebGLProgramParametersWithUniforms) => {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uTransformTex = { value: null };
  shader.uniforms.uOpacityTex = { value: null };
  shader.uniforms.uSampleCount = { value: 1 };
  shader.uniforms.uPartCount = { value: 0 };
  shader.uniforms.uClipCount = { value: 1 };
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

    shader.vertexShader = `
      ${VERTEX_ATTRIBUTES}
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
        vInstanceAlpha = instanceAlpha;
        vInstanceMinimapMask = instanceMinimapMask;
        vPlayerMask = playerMask;
        vPlayerColor = instancePlayerColor;
        vTint = instanceTint;

        float clip = instanceAnim.x;
        float phase = instanceAnim.y;
        float speed = instanceAnim.z;
        vec4 animTransform = sampleAnimation(partID, clip, phase, speed);
        vAnimOpacity = sampleOpacity(partID, clip, phase, speed);

        float tx = animTransform.r;
        float ty = animTransform.g;
        float rot = animTransform.b;
        float scale = animTransform.a;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      TRANSFORM_VERTEX,
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
      #if defined( USE_COLOR_ALPHA )
        vColor = vec4( 1.0 );
      #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        vColor = vec3( 1.0 );
      #endif
      #ifdef USE_COLOR
        vColor *= color;
      #endif

      if (vPlayerMask < 0.5) {
        vColor *= vTint;
      }

      if (vPlayerMask > 0.5) {
        vec3 srgb = mix(
          vColor.xyz * 12.92,
          pow(vColor.xyz, vec3(1.0 / 2.4)) * 1.055 - 0.055,
          step(0.0031308, vColor.xyz)
        );
        float lum = (srgb.r + srgb.g + srgb.b) / 3.0;
        if (lum < 0.5) {
          vColor.xyz = instancePlayerColor * (lum * 2.0);
        } else {
          vColor.xyz = mix(instancePlayerColor, vec3(1.0), (lum - 0.5) * 2.0);
        }
      }
      #ifdef USE_INSTANCING_COLOR
      else {
        vColor.xyz *= instanceColor.xyz;
      }
      #endif
      `,
    );

    shader.fragmentShader = `
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
      #if defined( USE_COLOR_ALPHA )
        diffuseColor *= vInstanceMinimapMask > 0.5 ? vec4(vPlayerColor, 1.0) : vColor;
      #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        diffuseColor.rgb *= vInstanceMinimapMask > 0.5 ? vPlayerColor : vColor;
      #endif
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
        float clip = instanceAnim.x;
        float phase = instanceAnim.y;
        float speed = instanceAnim.z;
        vec4 animTransform = sampleAnimation(partID, clip, phase, speed);
        float animOpacity = sampleOpacity(partID, clip, phase, speed);
        vFinalOpacity = instanceAlpha * animOpacity;
        vInstanceAlpha = instanceAlpha;

        float tx = animTransform.r;
        float ty = animTransform.g;
        float rot = animTransform.b;
        float scale = animTransform.a;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      TRANSFORM_VERTEX,
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
