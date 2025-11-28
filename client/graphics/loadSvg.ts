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
import { svgs } from "../systems/three.ts";

const loader = new SVGLoader();
let zOrderCounter = 0;

const addInstanceAlpha = (shader: WebGLProgramParametersWithUniforms) => {
  // 1) Declare our attributes & varyings
  // instanceAlpha encodes alpha + progressive mode: values > 1.0 = progressive mode (subtract 1 to get alpha)
  // vertexOpacity encodes opacity + playerMask: values > 1.0 = player vertex (subtract 1 to get opacity)
  // shapeInfo is vec2: .x = shapeIndex (0-1), .y = shapeStep (1/shapeCount)
  shader.vertexShader = "attribute float instanceAlpha;\n" +
    "attribute float instanceMinimapMask;\n" +
    "attribute float vertexOpacity;\n" +
    "attribute vec2 shapeInfo;\n" +
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
      "  vInstanceMinimapMask = instanceMinimapMask;\n" +
      "  vPlayerMask = vertexOpacity > 1.0 ? 1.0 : 0.0;\n" +
      "  vVertexOpacity = vertexOpacity > 1.0 ? vertexOpacity - 2.0 : vertexOpacity;\n" +
      "  vShapeIndex = shapeInfo.x;\n" +
      "  vShapeStep = shapeInfo.y;\n" +
      "  vPlayerColor = instancePlayerColor;",
  );

  // Apply colors: base vertex color * instanceColor (all vertices) * playerColor (player vertices only)
  shader.vertexShader = shader.vertexShader.replace(
    /#include <color_vertex>/,
    `#if defined( USE_COLOR_ALPHA )
      vColor = vec4( 1.0 );
    #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
      vColor = vec3( 1.0 );
    #endif
    #ifdef USE_COLOR
      vColor *= color;
    #endif
    #ifdef USE_INSTANCING_COLOR
      // instanceColor applies to ALL vertices
      vColor.xyz *= instanceColor.xyz;
    #endif
    // playerColor applies only to player-masked vertices
    vColor.xyz *= vPlayerMask > 0.5 ? instancePlayerColor : vec3(1.0);`,
  );

  shader.fragmentShader = "varying float vInstanceAlpha;\n" +
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
    `#if defined( USE_COLOR_ALPHA )
      diffuseColor *= vInstanceMinimapMask > 0.5 ? vec4(vPlayerColor, 1.0) : vColor;
    #elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
      diffuseColor.rgb *= vInstanceMinimapMask > 0.5 ? vPlayerColor : vColor;
    #endif`,
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
  zOrder?: number,
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

  // Now that we know total shape count, add shapeInfo (vec2: shapeIndex, shapeStep)
  const shapeCount = geometries.length;
  const shapeStep = shapeCount > 0 ? 1 / shapeCount : 1;
  for (const geo of geometries) {
    const vertexCount = geo.attributes.position.count;
    const shapeIdx = geo.userData?.shapeIdx ?? 0;
    // Normalize shapeIndex to 0-1 range (start of this shape's window)
    const normalizedIndex = shapeIdx / shapeCount;

    // Pack shapeIndex and shapeStep into vec2
    const shapeInfoData = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      shapeInfoData[i * 2] = normalizedIndex;
      shapeInfoData[i * 2 + 1] = shapeStep;
    }
    geo.setAttribute("shapeInfo", new BufferAttribute(shapeInfoData, 2));
  }

  // Create instanced mesh from merged geometries
  const isvg = new InstancedSvg(geometries, sharedMaterial, count, name);
  if (typeof layer === "number") isvg.layers.set(layer);

  // Apply render order (use provided zOrder or auto-increment)
  const currentZOrder = zOrder ?? zOrderCounter++;
  isvg.renderOrder = currentZOrder;

  scene.add(isvg);
  return isvg;
};
