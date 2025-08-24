import { ContextManager } from "@/shared/util/ContextManager.ts";
import { type Client } from "./client.ts";
import { type Lobby } from "./lobby.ts";

export const clientContext = new ContextManager<Client>();
export const lobbyContext = new ContextManager<Lobby>();
