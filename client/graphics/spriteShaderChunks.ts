import { WATER_SHADER_ENTITY_TINT } from "./waterShader.ts";

/**
 * Vertex: decodes `instanceMinimapMask`, which packs the minimap flag as a +4
 * offset on top of submergence (a float in [0, 4), not a quantized 0..1).
 * Writes `vInstanceMinimapMask` and declares `float submergence`.
 */
export const SPRITE_MINIMAP_MASK_DECODE = `
  vInstanceMinimapMask = instanceMinimapMask >= 4.0 ? 1.0 : 0.0;
  float submergence = instanceMinimapMask - vInstanceMinimapMask * 4.0;
`;

/** Vertex: starts `vColor` from white times the vertex colour. */
export const SPRITE_VERTEX_COLOR_INIT = `
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
    vColor = vec4( 1.0 );
  #endif
  #ifdef USE_COLOR
    vColor.rgb *= color;
  #endif
`;

/**
 * Vertex: player-masked vertices take a luminosity blend of the player colour
 * (vertex colour luminosity 0 = black, 0.5 = player colour, 1 = white, measured
 * in sRGB like Three.js LinearToSRGB); other vertices are tinted by
 * `instanceColor`.
 */
export const SPRITE_PLAYER_COLOR_BLEND = `
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
`;

/**
 * Fragment replacement for `color_fragment`: a solid player-colour silhouette
 * on the minimap, the vertex colour otherwise, then the water tint.
 */
export const SPRITE_COLOR_FRAGMENT = `
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR )
    diffuseColor *= vInstanceMinimapMask > 0.5 ? vec4(vPlayerColor, 1.0) : vColor;
  #endif
  ${WATER_SHADER_ENTITY_TINT}
`;
