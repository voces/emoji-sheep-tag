import { ContextManager } from "@/shared/util/ContextManager.ts";
import type { Lobby } from "./lobby.ts";
import type { Client } from "./client.ts";

export const clientContext = new ContextManager<Client>();
export const lobbyContext = new ContextManager<Lobby>();
