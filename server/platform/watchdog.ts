/// <reference lib="deno.unstable" />

import { env } from "./env.ts";

const NOTIFY_SOCKET = env("NOTIFY_SOCKET");
const WATCHDOG_USEC = Number(env("WATCHDOG_USEC") || 0);

type Notifier = (state: string) => void | Promise<void>;

type BunFfi = {
  dlopen: (
    path: string,
    symbols: { sd_notify: { args: ["i32", "cstring"]; returns: "i32" } },
  ) => { symbols: { sd_notify: (unset: number, state: Uint8Array) => number } };
};

/** libsystemd's sd_notify, which reads NOTIFY_SOCKET itself. */
const bunNotifier = async (): Promise<Notifier> => {
  const ffiModule = "bun:ffi";
  const { dlopen }: BunFfi = await import(ffiModule);
  const { symbols } = dlopen("libsystemd.so.0", {
    sd_notify: { args: ["i32", "cstring"], returns: "i32" },
  });
  const enc = new TextEncoder();
  return (state) => {
    if (symbols.sd_notify(0, enc.encode(`${state}\0`)) < 0) {
      throw new Error("sd_notify failed");
    }
  };
};

const denoNotifier = (socketPath: string): Notifier => {
  const socket = Deno.listenDatagram({ transport: "unixpacket", path: "" });
  const enc = new TextEncoder();
  // Abstract-namespace sockets start with "@"; replace with leading NUL
  const path = socketPath.startsWith("@")
    ? `\0${socketPath.slice(1)}`
    : socketPath;
  return async (state) =>
    void await socket.send(enc.encode(state), {
      transport: "unixpacket",
      path,
    });
};

let notifier: Promise<Notifier | undefined> | undefined;

const getNotifier = () =>
  notifier ??= (async () => {
    if (!NOTIFY_SOCKET) return;
    try {
      return "Bun" in globalThis
        ? await bunNotifier()
        : denoNotifier(NOTIFY_SOCKET);
    } catch (error) {
      console.debug(
        `[Watchdog] Failed to create notifier: ${(error as Error).message}`,
      );
    }
  })();

const sdNotify = async (state: string) => {
  const notify = await getNotifier();
  try {
    await notify?.(state);
  } catch (error) {
    console.debug(`[Watchdog] Notify failed: ${(error as Error).message}`);
  }
};

/** Call once, as soon as the server is ready to accept players */
export const notifyReady = () => sdNotify("READY=1");

/** Start the periodic WATCHDOG=1 pings (no-op if watchdog not configured) */
export const armWatchdog = () => {
  if (WATCHDOG_USEC === 0) {
    console.debug("[Watchdog] Not armed - WATCHDOG_USEC not set");
    return;
  }

  const intervalMs = WATCHDOG_USEC / 2 / 1000; // < ½ timeout
  console.log(
    `[Watchdog] Armed with interval ${intervalMs}ms (timeout: ${
      WATCHDOG_USEC / 1000
    }ms)`,
  );
  setInterval(() => void sdNotify("WATCHDOG=1"), intervalMs);
};

export const startWatchdog = async () => {
  console.debug(
    `[Watchdog] NOTIFY_SOCKET=${NOTIFY_SOCKET || "not set"}, WATCHDOG_USEC=${
      WATCHDOG_USEC || "not set"
    }`,
  );
  await notifyReady();
  armWatchdog();
};
