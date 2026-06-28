import { afterEach, describe } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { cleanupTest, it } from "@/server-testing/setup.ts";
import { Client } from "../client.ts";
import { generic } from "./generic.ts";
import { joinLobby } from "./joinLobby.ts";

afterEach(cleanupTest);

const mkClient = (id: string, ip?: string) => {
  const client = new Client(
    {
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    },
    undefined,
    ip,
  );
  client.id = id;
  client.name = id;
  return client;
};

const ban = (host: Client, playerId: string) =>
  generic(host, { type: "generic", event: { type: "ban", playerId } });

describe("ban", () => {
  it(
    "host banning a player removes them and bars their IP from rejoining",
    { sheep: [], wolves: [] },
    ({ lobby }) => {
      lobby.round = undefined;
      lobby.status = "lobby";
      const host = mkClient("host", "1.2.3.4");
      const target = mkClient("target", "5.6.7.8");
      for (const c of [host, target]) {
        lobby.players.add(c);
        c.lobby = lobby;
      }
      lobby.host = host;

      ban(host, "target");

      expect(lobby.players.has(target)).toBe(false);
      expect(target.lobby).toBeUndefined();
      expect(lobby.bannedIps?.has("5.6.7.8")).toBe(true);

      // A fresh connection from the same IP cannot rejoin
      const rejoin = mkClient("target-reconnect", "5.6.7.8");
      joinLobby(rejoin, { type: "joinLobby", lobbyName: lobby.name });
      expect(lobby.players.has(rejoin)).toBe(false);
      expect(rejoin.lobby).toBeUndefined();
    },
  );

  it(
    "a non-host cannot ban",
    { sheep: [], wolves: [] },
    ({ lobby }) => {
      lobby.round = undefined;
      lobby.status = "lobby";
      const host = mkClient("host", "1.2.3.4");
      const other = mkClient("other", "5.6.7.8");
      for (const c of [host, other]) {
        lobby.players.add(c);
        c.lobby = lobby;
      }
      lobby.host = host;

      ban(other, "host");

      expect(lobby.players.has(host)).toBe(true);
      expect(lobby.bannedIps?.has("1.2.3.4")).toBeFalsy();
    },
  );

  it(
    "the host cannot ban themselves",
    { sheep: [], wolves: [] },
    ({ lobby }) => {
      lobby.round = undefined;
      lobby.status = "lobby";
      const host = mkClient("host", "1.2.3.4");
      lobby.players.add(host);
      host.lobby = lobby;
      lobby.host = host;

      ban(host, "host");

      expect(lobby.players.has(host)).toBe(true);
      expect(lobby.bannedIps?.has("1.2.3.4")).toBeFalsy();
    },
  );
});
