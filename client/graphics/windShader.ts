/** Wind speed uniform value — shared between all wind consumers. */
export const WIND_SPEED = 0.3;

/** Spatial frequency of the wind field. */
export const WIND_FREQ_Y = 2.0;

/**
 * GLSL function: instantaneous wind value at a world position and time.
 * Returns horizontal wind force as a float.
 * Requires a `time` uniform or local variable to be in scope.
 */
export const WIND_SHADER_FN = /* glsl */ `
  float windAt(vec2 worldPos, float t) {
    // Two frequencies + x-axis variation for less monotonous sway
    float w1 = sin(worldPos.y * ${WIND_FREQ_Y.toFixed(1)} + t * ${
  WIND_SPEED.toFixed(1)
});
    float w2 = sin(worldPos.y * 3.7 + worldPos.x * 1.3 + t * 0.5) * 0.4;
    float w3 = sin(worldPos.x * 2.1 + t * 0.7) * 0.3;
    return (w1 + w2 + w3) * 0.18;
  }
`;

/**
 * GLSL function: integrated wind displacement over a duration.
 * Used by particles that need accumulated displacement, not instantaneous value.
 * Parameters: startY, velocity Y, birthTime, age.
 */
export const WIND_SHADER_INTEGRAL_FN = /* glsl */ `
  float windIntegral(float startY, float vy, float birthTime, float age) {
    float freqY = ${WIND_FREQ_Y.toFixed(1)};
    float freqT = ${WIND_SPEED.toFixed(1)};
    float a = vy * freqY + freqT;
    float b = startY * freqY + birthTime * freqT;
    if (abs(a) > 0.001) {
      return (-cos(a * age + b) + cos(b)) / a * 0.3;
    }
    return sin(b) * age * 0.3;
  }
`;
