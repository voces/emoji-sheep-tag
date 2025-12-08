import { appContext } from "@/shared/context.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { flushUpdates } from "../updates.ts";

const tryGetClient = () => {
  try {
    return clientContext.current;
  } catch {
    return undefined;
  }
};

const tryGetEcs = () => {
  try {
    return appContext.current;
  } catch {
    return undefined;
  }
};

export const timeout = (cb: () => void, seconds: number) => {
  const lobby = lobbyContext.current;
  // Try appContext first (set during initializeGame), fall back to lobby.round?.ecs
  const ecs = tryGetEcs() ?? lobby.round?.ecs;
  if (!ecs) throw new Error("Expected ECS to be defined");
  const lobbyRef = new WeakRef(lobby);
  const ecsRef = new WeakRef(ecs);
  const client = tryGetClient();
  const clientRef = client ? new WeakRef(client) : undefined;
  const t = setTimeout(
    () => {
      const lobby = lobbyRef.deref();
      const ecs = ecsRef.deref();
      const client = clientRef?.deref();
      // Check if lobby and ecs still exist and round is still active
      if (!lobby || !ecs || ecs !== lobby.round?.ecs) return clearTimeout(t);
      lobbyContext.with(lobby, () => {
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
  // Try appContext first (set during initializeGame), fall back to lobby.round?.ecs
  const ecs = tryGetEcs() ?? lobby.round?.ecs;
  if (!ecs) throw new Error("Expected ECS to be defined");
  const lobbyRef = new WeakRef(lobby);
  const ecsRef = new WeakRef(ecs);
  const client = tryGetClient();
  const clientRef = client ? new WeakRef(client) : undefined;
  const i = setInterval(
    () => {
      const lobby = lobbyRef.deref();
      const ecs = ecsRef.deref();
      const client = clientRef?.deref();
      // Check if lobby and ecs still exist and round is still active
      if (!lobby || !ecs || ecs !== lobby.round?.ecs) return clearInterval(i);
      lobbyContext.with(lobby, () => {
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
