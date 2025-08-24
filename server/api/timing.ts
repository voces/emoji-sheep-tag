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
        if (!lobby.round?.ecs) return clearTimeout(t);
        try {
          appContext.with(
            lobby.round.ecs,
            () => clientContext.with(client, cb),
          );
        } finally {
          flushUpdates();
        }
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
        if (!lobby.round?.ecs) return clearInterval(i);
        try {
          appContext.with(
            lobby.round.ecs,
            () => clientContext.with(client, cb),
          );
        } finally {
          flushUpdates();
        }
      }),
    interval * 1000,
  );
  return () => clearInterval(i);
};
