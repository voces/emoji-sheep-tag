import { clientContext, lobbyContext } from "../contexts.ts";

/**
 * @param cb
 * @param timeout Mill
 * @returns
 */
export const timeout = (cb: () => void, timeout: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const t = setTimeout(
    () =>
      lobbyContext.with(lobby, () => {
        if (!lobby.round?.ecs) return clearTimeout(t);
        clientContext.with(client, cb);
      }),
    timeout * 1000,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, interval: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const i = setInterval(
    () =>
      lobbyContext.with(lobby, () => {
        if (!lobby.round?.ecs) return clearInterval(i);
        clientContext.with(client, cb);
      }),
    interval * 1000,
  );
  return () => clearInterval(i);
};
