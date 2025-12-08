import { z } from "zod";
import { appContext } from "@/shared/context.ts";
import { flushUpdates } from "../updates.ts";
import { clientContext, lobbyContext } from "../contexts.ts";

// Shared socket types
export type SocketEventMap = {
  close: unknown;
  error: unknown;
  message: { data: unknown };
  open: unknown;
};

export type Socket = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  addEventListener: <K extends keyof SocketEventMap>(
    type: K,
    listener: (this: Socket, ev: SocketEventMap[K]) => void,
  ) => void;
};

// WebSocket close codes for shard connections
export const WS_CLOSE_MISSING_PARAMS = 4001;
export const WS_CLOSE_LOBBY_NOT_FOUND = 4002;
export const WS_CLOSE_INVALID_TOKEN = 4003;

import type { Client } from "../client.ts";
import type { Lobby } from "../lobby.ts";
import type { GameClient } from "../shard/gameClient.ts";
import type { ShardLobby } from "../shard/shardLobby.ts";

type ContextClient =
  | (Client & { lobby?: Lobby })
  | (GameClient & { lobby: ShardLobby });

// deno-lint-ignore no-explicit-any
export const wrapWithContext = <T extends (...args: any[]) => unknown>(
  client: ContextClient,
  fn: (...args: Parameters<T>) => ReturnType<T>,
) =>
(...args: Parameters<T>) => {
  if (client.lobby) {
    if (client.lobby.round) {
      return appContext.with(
        client.lobby.round.ecs,
        () =>
          lobbyContext.with(
            client.lobby!,
            () => clientContext.with(client, () => fn(...args)),
          ),
      );
    }
    return lobbyContext.with(
      client.lobby!,
      () => clientContext.with(client, () => fn(...args)),
    );
  }
  return clientContext.with(client, () => fn(...args));
};

// Handle incoming messages with standard parse/batch/action pattern
export const handleMessage = <
  TSchema extends z.ZodType,
  TClient,
>(
  e: SocketEventMap["message"],
  schema: TSchema,
  // deno-lint-ignore no-explicit-any
  actions: Record<string, (client: TClient, message: any) => void>,
  client: TClient,
  onError?: () => void,
) => {
  let batch = (fn: () => void) => fn();
  try {
    batch = appContext.current.batch;
  } catch { /* do nothing */ }
  try {
    batch(() => {
      try {
        if (typeof e.data !== "string") {
          throw new Error("Expected data to be a string");
        }
        const json = JSON.parse(e.data);
        const message = schema.parse(json) as { type: string };
        try {
          actions[message.type](client, message);
        } catch (err) {
          console.error("[socketHandler] Action error:", err);
        }
      } catch (err) {
        console.error("[socketHandler] Message parse error:", err);
        onError?.();
      }
    });
  } finally {
    flushUpdates();
  }
};
