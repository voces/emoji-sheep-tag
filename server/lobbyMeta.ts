import { lobbies, type Lobby } from "./lobby.ts";
import { getMapMeta } from "@/shared/maps/manifest.ts";
import type { Mode } from "@/shared/round.ts";

const SITE_NAME = "Emoji Sheep Tag";
const DEFAULT_DESCRIPTION =
  "A real-time multiplayer sheep-tag game. Pick a side, build a maze, and survive — or hunt.";

const MODE_LABELS: Record<Mode, string> = {
  survival: "Survival",
  vip: "VIP",
  switch: "Switch",
  vamp: "Vamp",
  bulldog: "Bulldog",
};

const escapeAttr = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderTags = (
  tags: ReadonlyArray<readonly [string, string]>,
  url: string,
) => {
  const lines = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta name="twitter:card" content="summary">`,
    ...tags.map(([key, value]) => {
      const property = key.startsWith("twitter:") ? "name" : "property";
      return `<meta ${property}="${key}" content="${escapeAttr(value)}">`;
    }),
  ];
  return lines.join("\n    ");
};

const buildLobbyDescription = (lobby: Lobby): string => {
  const mode = MODE_LABELS[lobby.settings.mode];
  const map = getMapMeta(lobby.settings.map)?.name ?? lobby.settings.map;
  const host = lobby.host?.name;
  const lead = host ? `${host}'s lobby` : "Open lobby";
  return `${lead} · ${mode} on ${map}`;
};

export const buildLobbyMetaTags = (
  url: URL,
  lobbyName: string | null,
): string => {
  const fullUrl = url.toString();
  if (!lobbyName) {
    return renderTags([
      ["og:title", SITE_NAME],
      ["og:description", DEFAULT_DESCRIPTION],
      ["twitter:title", SITE_NAME],
      ["twitter:description", DEFAULT_DESCRIPTION],
    ], fullUrl);
  }

  const lobby = Array.from(lobbies).find((l) => l.name === lobbyName);
  if (!lobby) {
    const title = `${lobbyName} — ${SITE_NAME}`;
    const desc =
      `This lobby is no longer available. Browse open games instead.`;
    return renderTags([
      ["og:title", title],
      ["og:description", desc],
      ["twitter:title", title],
      ["twitter:description", desc],
    ], fullUrl);
  }

  const title = `Join "${lobby.name}" — ${SITE_NAME}`;
  const description = buildLobbyDescription(lobby);
  return renderTags([
    ["og:title", title],
    ["og:description", description],
    ["twitter:title", title],
    ["twitter:description", description],
  ], fullUrl);
};
