/// <reference lib="deno.unstable" />

const enc = new TextEncoder();

const NOTIFY_SOCKET = Deno.env.get("NOTIFY_SOCKET");
const WATCHDOG_USEC = Number(Deno.env.get("WATCHDOG_USEC") || 0);

/** Store the notify socket path for sending messages */
let notifySocketPath: string | null = null;

/** Initialize the notify socket path */
function initNotifySocket() {
  if (!NOTIFY_SOCKET) return null;

  // Abstract-namespace sockets start with "@"; replace with leading NUL
  notifySocketPath = NOTIFY_SOCKET.startsWith("@")
    ? `\0${NOTIFY_SOCKET.slice(1)}`
    : NOTIFY_SOCKET;

  return notifySocketPath;
}

const socketPath = initNotifySocket();

async function sdNotify(state: string) {
  if (!socketPath) return; // not running under systemd

  try {
    // Try using UDP socket approach which is more common for systemd notifications
    const process = new Deno.Command("systemd-notify", {
      args: [state],
      stdout: "null",
      stderr: "null",
    });
    await process.output();
  } catch (error) {
    // If systemd-notify command is not available, try manual socket approach
    try {
      const conn = await Deno.connect({ transport: "unix", path: socketPath });
      try {
        await conn.write(enc.encode(state));
      } finally {
        conn.close();
      }
    } catch (socketError) {
      // Silently ignore - service might not be running under systemd
      const errorMsg = error instanceof Error ? error.message : String(error);
      const socketErrorMsg = socketError instanceof Error
        ? socketError.message
        : String(socketError);
      console.debug(
        `Watchdog notification failed: ${errorMsg}, ${socketErrorMsg}`,
      );
    }
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
