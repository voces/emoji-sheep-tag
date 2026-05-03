const LOBBY_PARAM = "lobby";

const readPendingFromUrl = (): string | null => {
  if (typeof location === "undefined") return null;
  const params = new URLSearchParams(location.search);
  const name = params.get(LOBBY_PARAM);
  return name && name.trim() ? name : null;
};

let pendingJoinLobby: string | null = readPendingFromUrl();

export const consumePendingJoinLobby = (): string | null => {
  const name = pendingJoinLobby;
  pendingJoinLobby = null;
  if (typeof history !== "undefined" && typeof location !== "undefined") {
    const params = new URLSearchParams(location.search);
    if (params.has(LOBBY_PARAM)) {
      params.delete(LOBBY_PARAM);
      const query = params.toString();
      const url = `${location.pathname}${
        query ? `?${query}` : ""
      }${location.hash}`;
      history.replaceState(null, "", url);
    }
  }
  return name;
};

export const buildLobbyShareUrl = (lobbyName: string): string => {
  const url = new URL(globalThis.location?.href ?? "http://localhost/");
  url.searchParams.set(LOBBY_PARAM, lobbyName);
  url.hash = "";
  return url.toString();
};

if (pendingJoinLobby) {
  import("./connection.ts").then(({ connect }) => connect());
}
