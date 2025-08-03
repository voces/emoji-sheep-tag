const PLAYER_NAME_KEY = "emoji-sheep-tag-player-name";

export const getStoredPlayerName = (): string | null => {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    return null;
  }
};

export const setStoredPlayerName = (name: string): void => {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // Silently fail if localStorage is not available
  }
};