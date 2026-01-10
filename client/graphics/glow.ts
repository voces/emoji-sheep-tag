import {
  BufferAttribute,
  DoubleSide,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { InstancedSvg } from "./InstancedSvg.ts";
import { onRender, scene } from "./three.ts";

// Create glow geometry with required attributes
const glowGeometry = new PlaneGeometry(1.0, 1.0);

// Add required attributes for InstancedSvg compatibility
const vertexCount = glowGeometry.attributes.position.count;

// Color attribute (white)
const colors = new Float32Array(vertexCount * 3).fill(1);
glowGeometry.setAttribute("color", new BufferAttribute(colors, 3));

// Intrinsic opacity (full opacity)
const opacities = new Float32Array(vertexCount).fill(1);
glowGeometry.setAttribute(
  "intrinsicOpacity",
  new BufferAttribute(opacities, 1),
);

// Player mask (all player-colored)
glowGeometry.userData = { player: true };

const glowMaterial = new MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
  userData: { player: true },
  forceSinglePass: true,
});
glowMaterial.customProgramCacheKey = () => "glowMaterial";

// Modify shader to add complex radial fade with pulsing
glowMaterial.onBeforeCompile = (shader) => {
  // Add time uniform
  shader.uniforms.time = { value: 0 };

  // Add instanceAlpha and instancePlayerColor attributes and varyings
  shader.vertexShader = "attribute float instanceAlpha;\n" +
    "attribute vec3 instancePlayerColor;\n" +
    "varying float vInstanceAlpha;\n" +
    "varying vec3 vPlayerColor;\n" +
    shader.vertexShader;

  // Pass position, instanceAlpha, and playerColor to fragment shader
  shader.vertexShader = shader.vertexShader.replace(
    "void main() {",
    `
    varying vec3 vLocalPosition;
    void main() {
      vLocalPosition = position;
      vInstanceAlpha = instanceAlpha;
      vPlayerColor = instancePlayerColor;
    `,
  );

  // Add complex radial fade to diffuse color calculation with pulsing
  shader.fragmentShader = "varying float vInstanceAlpha;\n" +
    "varying vec3 vPlayerColor;\n" +
    shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    `
    uniform float time;
    varying vec3 vLocalPosition;
    void main() {
    `,
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    /vec4 diffuseColor = vec4\( diffuse, opacity \);/,
    `
      // Calculate distance and angle
      float dist = length(vLocalPosition.xy);
      float angle = atan(vLocalPosition.y, vLocalPosition.x);

      // Normalized distance (0 at center, 1 at edge)
      float t = clamp(dist / 0.5, 0.0, 1.0);

      // Pulsing power: oscillates between 0.2 and 0.4
      float power = 2.0 + (sin(time * 1.7) + sin(time * 2.0)) * 0.5;

      // Base radial fade from center to edge
      float radialFade = pow((cos(t * 3.1415) + 1.0) / 2.0, power);

      // Three different "arm" patterns that modulate brightness
      float arms1 = sin(angle * 2.0 + time * 1.5) * 0.5 + 0.5; // 2 lobes
      float arms2 = sin(angle * 3.0 - time * 2.0) * 0.5 + 0.5; // 3 lobes
      float arms3 = sin(angle * 5.0 + time * 1.0) * 0.5 + 0.5; // 5 lobes

      // Combine arms with different weights
      float armPattern = arms1 * 0.5 + arms2 * 0.3 + arms3 * 0.2;

      // Make arms more nebulous near core by increasing influence with distance
      float armInfluence = pow(t, 0.5); // Stronger arm effect further from center

      // Modulate radial fade by arm pattern (0.4 to 1.0 range to keep some base brightness)
      float fadeAlpha = radialFade * (0.4 + armPattern * 0.6 * armInfluence + (1.0 - armInfluence) * 0.2);

      vec4 diffuseColor = vec4( diffuse * vPlayerColor, opacity * fadeAlpha * vInstanceAlpha );
    `,
  );

  // Store shader reference for updates
  glowMaterial.userData.shader = shader;
};

export const glow = new InstancedSvg([glowGeometry], glowMaterial, 1, "glow");
glow.layers.set(2);
scene.add(glow);

// Update glow shader time uniform for pulsing animation
onRender((_, time) => {
  const shader = glowMaterial.userData.shader;
  if (shader?.uniforms.time) shader.uniforms.time.value = time;
});
