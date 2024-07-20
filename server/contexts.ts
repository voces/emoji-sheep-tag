import { ContextManager } from "./ContextManager.ts";
import { type Client } from "./client.ts";
import { type Lobby } from "./lobby.ts";

export const clientContext = new ContextManager<Client>();
export const lobbyContext = new ContextManager<Lobby>();
export const currentApp = () => {
  const app = lobbyContext.context.round?.ecs;
  if (!app) throw new Error("Expected there to be an an active app");
  return app;
};
