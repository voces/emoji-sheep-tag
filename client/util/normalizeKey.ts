/**
 * Normalizes keyboard key codes by removing Left/Right distinctions from modifier keys.
 * This allows users to use either left or right modifier keys interchangeably.
 * 
 * @param key - The key code to normalize (e.g., "ControlLeft", "ShiftRight")
 * @returns The normalized key code (e.g., "Control", "Shift")
 */
export const normalizeKey = (key: string): string => {
  // Normalize left/right modifiers to their generic form
  return key.replace(/^(Control|Alt|Shift|Meta)(Left|Right)$/, '$1');
};

/**
 * Normalizes an array of keys for shortcut comparison
 * @param keys - Array of key codes to normalize
 * @returns Array of normalized key codes
 */
export const normalizeKeys = (keys: string[]): string[] => {
  return keys.map(normalizeKey);
};