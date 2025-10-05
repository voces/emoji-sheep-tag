import { appContext } from "@/shared/context.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { flushUpdates } from "../updates.ts";
import { lobbies } from "../lobby.ts";

/**
 * @param cb
 * @param timeout Mill
 * @returns
 */
export const timeout = (cb: () => void, timeout: number) => {
  const lobby = lobbyContext.current;
  const ecs = lobby.round?.ecs;
  const client = clientContext.current;
  const t = setTimeout(
    () => {
      if (!lobbies.has(lobby)) return;
      lobbyContext.with(lobby, () => {
        if (!ecs || ecs !== lobby.round?.ecs) return;
        appContext.with(
          ecs,
          () =>
            clientContext.with(client, () => {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }),
        );
        flushUpdates();
      });
    },
    timeout * 1000,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, intervalSeconds: number) => {
  const lobby = lobbyContext.current;
  const ecs = lobby.round?.ecs;
  const client = clientContext.current;
  const i = setInterval(
    () => {
      if (!lobbies.has(lobby)) return clearInterval(i);
      lobbyContext.with(lobby, () => {
        if (!ecs || ecs !== lobby.round?.ecs) return clearInterval(i);
        appContext.with(
          ecs,
          () =>
            clientContext.with(client, () => {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }),
        );
        flushUpdates();
      });
    },
    intervalSeconds * 1000,
  );
  return () => clearInterval(i);
};
