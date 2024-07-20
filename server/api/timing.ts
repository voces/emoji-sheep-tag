import { clientContext, lobbyContext } from "../contexts.ts";

export const timeout = (cb: () => void, timeout: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const t = setTimeout(
    () => lobbyContext.with(lobby, () => clientContext.with(client, cb)),
    timeout,
  );
  return () => clearTimeout(t);
};

export const interval = (cb: () => void, interval: number) => {
  const lobby = lobbyContext.context;
  const client = clientContext.context;
  const i = setInterval(
    () => lobbyContext.with(lobby, () => clientContext.with(client, cb)),
    interval,
  );
  return () => clearInterval(i);
};
