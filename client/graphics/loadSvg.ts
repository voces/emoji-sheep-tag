import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshBasicMaterial,
  ShapeGeometry,
  Vector3,
  WebGLProgramParametersWithUniforms,
} from "three";
import { SVGLoader } from "three/SVGLoader";
import { InstancedSvg } from "./InstancedSvg.ts";
import { scene } from "./three.ts";
import { svgs } from "../systems/models.ts";
import { getAnimationTime } from "./AnimatedMeshMaterial.ts";
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

const instancedSvgShaders = new Set<WebGLProgramParametersWithUniforms>();

const loader = new SVGLoader();

const addInstanceAlpha = (shader: WebGLProgramParametersWithUniforms) => {
  instancedSvgShaders.add(shader);
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.waterRippleCount = waterRippleUniforms.waterRippleCount;
  shader.uniforms.waterRipples = waterRippleUniforms.waterRipples;

  // 1) Declare our attributes & varyings
  // instanceAlpha encodes alpha + progressive mode: values > 1.0 = progressive mode (subtract 1 to get alpha)
  // vertexOpacity encodes opacity + playerMask: values > 1.0 = player vertex (subtract 1 to get opacity)
  // shapeInfo is vec3: .x = shapeIndex (0-1), .y = shapeStep (1/shapeCount), .z = normalized sprite Y
  shader.vertexShader = WATER_SHADER_MOTION +
    WATER_SHADER_ENTITY_VARYINGS +
    "uniform float uTime;\n" +
    "attribute float instanceAlpha;\n" +
    "attribute float instanceMinimapMask;\n" +
    "attribute float vertexOpacity;\n" +
    "attribute vec3 shapeInfo;\n" +
    "attribute vec3 instancePlayerColor;\n" +
    "varying float vInstanceAlpha;\n" +
    "varying float vInstanceMinimapMask;\n" +
    "varying float vVertexOpacity;\n" +
    "varying float vShapeIndex;\n" +
    "varying float vShapeStep;\n" +
    "varying float vProgressiveMode;\n" +
    "varying float vPlayerMask;\n" +
    "varying vec3 vPlayerColor;\n" +
    shader.vertexShader;

  // 2) Pass them through in the vertex stage
  // Decode progressive mode from instanceAlpha (values > 1.0, offset by 2)
  // Decode playerMask from vertexOpacity (values > 1.0, offset by 2)
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    "void main() {\n" +
      "  vProgressiveMode = instanceAlpha > 1.0 ? 1.0 : 0.0;\n" +
      "  vInstanceAlpha = instanceAlpha > 1.0 ? instanceAlpha - 2.0 : instanceAlpha;\n" +
      // instanceMinimapMask packs the minimap flag as a +4 offset on top of
      // submergence (stored as a float in [0, 4), not a quantized 0..1).
      "  vInstanceMinimapMask = instanceMinimapMask >= 4.0 ? 1.0 : 0.0;\n" +
      "  float submergence = instanceMinimapMask - vInstanceMinimapMask * 4.0;\n" +
      "  vPlayerMask = vertexOpacity > 1.0 ? 1.0 : 0.0;\n" +
      "  vVertexOpacity = vertexOpacity > 1.0 ? vertexOpacity - 2.0 : vertexOpacity;\n" +
      "  vShapeIndex = shapeInfo.x;\n" +
      "  vShapeStep = shapeInfo.y;\n" +
      "  vPlayerColor = instancePlayerColor;\n" +
      WATER_SHADER_ENTITY_VERTEX +
      "  vWaterline = shapeInfo.z - submergence - waterWaveOffset_;",
  );

  // Apply colors: base vertex color, then either instanceColor or playerColor luminosity blend
  shader.vertexShader = shader.vertexShader.replace(
    /#include <color_vertex>/,
    `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
      vColor = vec4( 1.0 );
    #endif
    #ifdef USE_COLOR
      vColor.rgb *= color;
    #endif
    // playerColor: luminosity blend for player-masked vertices
    // vertex color encodes luminosity: 0=black, 0.5=playerColor, 1=white
    // Colors are in linear space; convert to sRGB for luminosity calculation
    if (vPlayerMask > 0.5) {
      // sRGB transfer function (matches Three.js LinearToSRGB)
      vec3 srgb = mix(
        vColor.rgb * 12.92,
        pow(vColor.rgb, vec3(1.0 / 2.4)) * 1.055 - 0.055,
        step(0.0031308, vColor.rgb)
      );
      float lum = (srgb.r + srgb.g + srgb.b) / 3.0;
      if (lum < 0.5) {
        // 0 -> 0.5 maps to black -> playerColor
        vColor.rgb = instancePlayerColor * (lum * 2.0);
      } else {
        // 0.5 -> 1 maps to playerColor -> white
        vColor.rgb = mix(instancePlayerColor, vec3(1.0), (lum - 0.5) * 2.0);
      }
    }
    #ifdef USE_INSTANCING_COLOR
    else {
      // instanceColor only applies to non-player vertices
      vColor.rgb *= instanceColor.rgb;
    }
    #endif`,
  );

  shader.fragmentShader = WATER_SHADER_CONSTANTS +
    WATER_SHADER_NOISE +
    WATER_SHADER_CAUSTICS +
    WATER_SHADER_RIPPLES +
    WATER_SHADER_ENTITY_VARYINGS +
    "uniform float uTime;\n" +
    "varying float vInstanceAlpha;\n" +
    "varying float vInstanceMinimapMask;\n" +
    "varying float vVertexOpacity;\n" +
    "varying float vShapeIndex;\n" +
    "varying float vShapeStep;\n" +
    "varying float vProgressiveMode;\n" +
    "varying float vPlayerMask;\n" +
    "varying vec3 vPlayerColor;\n" +
    shader.fragmentShader;

  // 3) In minimap mask mode, use solid player color silhouette
  // Otherwise, let standard color_fragment handle vertex colors, just adjust opacity
  // Progressive alpha: shapes fade in one at a time based on shapeIndex
  shader.fragmentShader = shader.fragmentShader.replace(
    /vec4 diffuseColor = vec4\( diffuse, opacity \);/,
    `float shapeAlpha = 1.0;
    if (vProgressiveMode > 0.5 && vShapeStep > 0.0) {
      // Each shape gets a window: shapeIndex to shapeIndex + shapeStep
      // Map vInstanceAlpha into this shape's window
      shapeAlpha = clamp((vInstanceAlpha - vShapeIndex) / vShapeStep, 0.0, 1.0);
    }
    float effectiveAlpha = vProgressiveMode > 0.5 ? shapeAlpha : vInstanceAlpha;
    float finalOpacity = vInstanceMinimapMask > 0.5 ? effectiveAlpha : vVertexOpacity * effectiveAlpha;
    vec4 diffuseColor = vec4( diffuse, finalOpacity );`,
  );

  // In minimap mode, use player color only (solid silhouette); otherwise use vColor
  shader.fragmentShader = shader.fragmentShader.replace(
    /#include <color_fragment>/,
    `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
      diffuseColor *= vInstanceMinimapMask > 0.5 ? vec4(vPlayerColor, 1.0) : vColor;
    #endif
    ${WATER_SHADER_ENTITY_TINT}`,
  );
};

const createMaterial = () => {
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: DoubleSide,
    depthWrite: true,
    forceSinglePass: true,
  });
  material.customProgramCacheKey = () => "instanceAlpha";
  material.onBeforeCompile = addInstanceAlpha;
  material.onBeforeRender = () => {
    const now = getAnimationTime();
    for (const shader of instancedSvgShaders) {
      shader.uniforms.uTime.value = now;
    }
  };
  return material;
};

const sharedMaterial = createMaterial();

export const loadSvg = (
  svg: string,
  scale: number,
  { count = 0, layer, yOffset = 0, xOffset = 0, facingOffset }: {
    count?: number;
    layer?: number;
    yOffset?: number;
    xOffset?: number;
    facingOffset?: number;
  } = {},
  zOrder: number,
) => {
  const name = Object.entries(svgs).find((e) => e[1] === svg)?.[0];
  scale /= 36 * 2; // SVGs are 36x36, and we want a sheep to be size 1

  const data = loader.parse(svg);

  // Collect geometries for merging
  const geometries: BufferGeometry[] = [];

  for (const path of data.paths) {
    const fillColor = path.userData?.style.fill;

    if (fillColor !== undefined && fillColor !== "none") {
      const opacity = path.userData?.style.opacity ??
        path.userData?.style.fillOpacity ?? 1;
      const isPlayer = "player" in path.userData?.node.dataset;
      const color = path.color;

      const shapes = SVGLoader.createShapes(path);

      for (const shape of shapes) {
        const geometry = new ShapeGeometry(shape);
        geometry.scale(scale, -scale, scale);

        // Add vertex colors (same color for all vertices in this shape)
        const vertexCount = geometry.attributes.position.count;
        const colors = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        geometry.setAttribute("color", new BufferAttribute(colors, 3));

        // Add vertex opacity (same for all vertices in this shape)
        // Encode playerMask: add 2 to opacity for player vertices (shader will decode)
        const encodedOpacity = isPlayer ? opacity + 2 : opacity;
        const opacities = new Float32Array(vertexCount).fill(encodedOpacity);
        geometry.setAttribute(
          "vertexOpacity",
          new BufferAttribute(opacities, 1),
        );

        // Store shapeIndex in userData temporarily; we'll set the attribute after counting all shapes
        // Also store player flag for InstancedSvg to build its internal mask
        geometry.userData = { player: isPlayer, shapeIdx: geometries.length };

        if (facingOffset) geometry.rotateZ(facingOffset);

        geometries.push(geometry);
      }
    }
  }

  // Calculate center offset
  const box = new Box3();
  for (const geo of geometries) {
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
  }
  const offset = new Vector3();
  box.getCenter(offset).multiplyScalar(-1);

  // Apply yOffset and xOffset to shift the geometry
  offset.y += yOffset;
  offset.x += xOffset;

  for (const geo of geometries) {
    geo.translate(offset.x, offset.y, 0);
  }

  // Pack shapeIndex, shapeStep, and sprite-local normalized Y (0=bottom, 1=top)
  // into a single vec3 attribute to stay under the 16-attribute GL limit.
  const spriteMinY = box.min.y + offset.y;
  const spriteMaxY = box.max.y + offset.y;
  const spriteYRange = spriteMaxY - spriteMinY;
  const invSpriteYRange = spriteYRange > 0 ? 1 / spriteYRange : 0;
  const shapeCount = geometries.length;
  const shapeStep = shapeCount > 0 ? 1 / shapeCount : 1;
  for (const geo of geometries) {
    const positions = geo.attributes.position.array;
    const vertexCount = geo.attributes.position.count;
    const shapeIdx = geo.userData?.shapeIdx ?? 0;
    const normalizedIndex = shapeIdx / shapeCount;

    const shapeInfoData = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      shapeInfoData[i * 3] = normalizedIndex;
      shapeInfoData[i * 3 + 1] = shapeStep;
      shapeInfoData[i * 3 + 2] = (positions[i * 3 + 1] - spriteMinY) *
        invSpriteYRange;
    }
    geo.setAttribute("shapeInfo", new BufferAttribute(shapeInfoData, 3));
  }

  // Create instanced mesh from merged geometries
  const isvg = new InstancedSvg(geometries, sharedMaterial, count, name);
  if (typeof layer === "number") isvg.layers.set(layer);

  isvg.renderOrder = zOrder;

  scene.add(isvg);
  return isvg;
};
