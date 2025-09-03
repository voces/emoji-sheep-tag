import { Color } from "three";

const tempColor1 = new Color();
const tempColor2 = new Color();
const white = new Color("white");

/**
 * Computes a blueprint color by lerping the player color towards white and then towards the target color
 * @param playerColorHex - The player's color in hex format
 * @param targetColorHex - The target color to lerp towards in hex format
 * @returns The computed color as a hex number
 */
export const computeBlueprintColor = (
  playerColorHex: string | number,
  targetColorHex: number,
): number => {
  tempColor1.set(playerColorHex);
  tempColor2.setHex(targetColorHex);

  // Lerp player color towards white by 80%
  tempColor1.lerp(white, 0.8);
  // Then lerp towards target color by 60%
  tempColor1.lerp(tempColor2, 0.6);

  return tempColor1.getHex();
};
