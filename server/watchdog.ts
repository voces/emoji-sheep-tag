/// <reference lib="deno.unstable" />

const NOTIFY_SOCKET = Deno.env.get("NOTIFY_SOCKET");
const WATCHDOG_USEC = Number(Deno.env.get("WATCHDOG_USEC") || 0);

async function sdNotify(state: string) {
  if (!NOTIFY_SOCKET) return; // not running under systemd

  try {
    // Parse the socket path (handle abstract namespace sockets)
    let socketPath = NOTIFY_SOCKET;
    if (NOTIFY_SOCKET.startsWith("@")) {
      // Abstract namespace socket - replace @ with \0
      socketPath = `\0${NOTIFY_SOCKET.slice(1)}`;
    }

    // Send notification directly via Unix socket from main process
    // This avoids the PID issue completely
    const conn = await Deno.connect({
      transport: "unix",
      path: socketPath,
    });

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(state);
      await conn.write(data);
    } finally {
      conn.close();
    }
  } catch (error) {
    // Silently ignore - we might not be running under systemd
    console.debug(`Systemd notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/* ------------------------------------------------------------------------- */

/** Call once, as soon as the server is ready to accept players */
export async function notifyReady() {
  await sdNotify("READY=1");
}

/** Start the periodic WATCHDOG=1 pings (no-op if watchdog not configured) */
export function armWatchdog() {
  if (WATCHDOG_USEC === 0) return;

  const intervalMs = WATCHDOG_USEC / 2 / 1000; // < ½ timeout
  setInterval(() => void sdNotify("WATCHDOG=1"), intervalMs);
}

/**
 * Notify systemd that the server is ready and start watchdog pings
 * Combines notifyReady() and armWatchdog() into a single call
 */
export async function startWatchdog() {
  await notifyReady();
  armWatchdog();
}
