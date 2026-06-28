import { makeVar } from "@/hooks/useVar.tsx";
import { z } from "zod";

// Players are ignored by their server-provided clientId (a stable, IP-derived
// hash), so the ignore persists across reconnects and sessions.
const ignoredPlayersSchema = z.array(z.string()).catch([]);

const IGNORED_PLAYERS_KEY = "emoji-sheep-tag-ignored-players";

const getStoredIgnoredPlayers = (): string[] => {
  try {
    const stored = localStorage.getItem(IGNORED_PLAYERS_KEY);
    if (stored) return ignoredPlayersSchema.parse(JSON.parse(stored));
  } catch {
    // Fall through to default
  }
  return [];
};

export const ignoredPlayersVar = makeVar<string[]>(getStoredIgnoredPlayers());

ignoredPlayersVar.subscribe((ignored) => {
  try {
    localStorage.setItem(IGNORED_PLAYERS_KEY, JSON.stringify(ignored));
  } catch {
    // Silently fail if localStorage is not available
  }
});

export const isPlayerIgnored = (clientId: string | undefined): boolean =>
  !!clientId && ignoredPlayersVar().includes(clientId);

export const toggleIgnoredPlayer = (clientId: string) => {
  ignoredPlayersVar((ignored) =>
    ignored.includes(clientId)
      ? ignored.filter((id) => id !== clientId)
      : [...ignored, clientId]
  );
};
