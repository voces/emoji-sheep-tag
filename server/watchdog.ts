/// <reference lib="deno.unstable" />

const NOTIFY_SOCKET = Deno.env.get("NOTIFY_SOCKET");
const WATCHDOG_USEC = Number(Deno.env.get("WATCHDOG_USEC") || 0);

async function sdNotify(state: string) {
  if (!NOTIFY_SOCKET) return; // not running under systemd

  try {
    // Send the raw state string to systemd-notify
    // systemd-notify expects the notification string as a simple argument
    const process = new Deno.Command("systemd-notify", {
      args: [state],
      stdout: "null",
      stderr: "null",
    });
    
    await process.output();
  } catch (error) {
    // Silently ignore - systemd-notify might not be available or we're not in systemd
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

  // Temporarily disable watchdog pings to avoid PID issues
  // The ready notification should be sufficient for now
  console.debug("Watchdog armed but disabled due to systemd PID restrictions");
  
  // Uncomment this line once we resolve the PID issue:
  // const intervalMs = WATCHDOG_USEC / 2 / 1000; // < ½ timeout
  // setInterval(() => void sdNotify("WATCHDOG=1"), intervalMs);
}

/**
 * Notify systemd that the server is ready and start watchdog pings
 * Combines notifyReady() and armWatchdog() into a single call
 */
export async function startWatchdog() {
  await notifyReady();
  armWatchdog();
}
