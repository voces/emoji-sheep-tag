import { appContext } from "@/shared/context.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { flushUpdates } from "../updates.ts";

/**
 * @param cb
 * @param timeout Mill
 * @returns
 */
export const timeout = (cb: () => void, timeout: number) => {
  const lobby = lobbyContext.current;
  const client = clientContext.current;
  const t = setTimeout(
    () =>
      lobbyContext.with(lobby, () => {
        const ecs = lobby.round?.ecs;
        if (!ecs) return clearTimeout(t);
        appContext.with(
          ecs,
          () =>
            clientContext.with(client, () => {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }),
        );
        flushUpdates();
      }),
    timeout * 1000,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, interval: number) => {
  const lobby = lobbyContext.current;
  const client = clientContext.current;
  const i = setInterval(
    () =>
      lobbyContext.with(lobby, () => {
        const ecs = lobby.round?.ecs;
        if (!ecs) return clearInterval(i);
        appContext.with(
          ecs,
          () =>
            clientContext.with(client, () => {
              if (ecs.flushScheduled) cb();
              else ecs.batch(cb);
            }),
        );
        flushUpdates();
      }),
    interval * 1000,
  );
  return () => clearInterval(i);
};
