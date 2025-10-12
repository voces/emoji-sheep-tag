import { appContext } from "@/shared/context.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { flushUpdates } from "../updates.ts";
import { lobbies } from "../lobby.ts";

export const timeout = (cb: () => void, seconds: number) => {
  const lobby = lobbyContext.current;
  const ecs = lobby.round?.ecs;
  if (!ecs) throw new Error("Expected ECS to be defined");
  const lobbyRef = new WeakRef(lobby);
  const ecsRef = new WeakRef(ecs);
  const clientRef = new WeakRef(clientContext.current);
  const t = setTimeout(
    () => {
      const lobby = lobbyRef.deref();
      const ecs = ecsRef.deref();
      const client = clientRef.deref();
      if (!lobby || !ecs || !lobbies.has(lobby)) return clearTimeout(t);
      lobbyContext.with(lobby, () => {
        if (!ecs || ecs !== lobby.round?.ecs) return clearTimeout(t);
        appContext.with(
          ecs,
          () => {
            if (client) {
              clientContext.with(client, () => {
                if (ecs.flushScheduled) cb();
                else ecs.batch(cb);
              });
            } else {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }
          },
        );
        flushUpdates();
      });
    },
    seconds * 1000,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, seconds: number) => {
  const lobby = lobbyContext.current;
  const ecs = lobby.round?.ecs;
  if (!ecs) throw new Error("Expected ECS to be defined");
  const lobbyRef = new WeakRef(lobby);
  const ecsRef = new WeakRef(ecs);
  const clientRef = new WeakRef(clientContext.current);
  const i = setInterval(
    () => {
      const lobby = lobbyRef.deref();
      const ecs = ecsRef.deref();
      const client = clientRef.deref();
      if (!lobby || !ecs || !lobbies.has(lobby)) return clearInterval(i);
      lobbyContext.with(lobby, () => {
        if (!ecs || ecs !== lobby.round?.ecs) return clearInterval(i);
        appContext.with(
          ecs,
          () => {
            if (client) {
              clientContext.with(client, () => {
                if (ecs.flushScheduled) cb();
                else ecs.batch(cb);
              });
            } else {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }
          },
        );
        flushUpdates();
      });
    },
    seconds * 1000,
  );
  return () => clearInterval(i);
};
