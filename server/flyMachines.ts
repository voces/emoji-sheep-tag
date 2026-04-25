/**
 * Fly.io Machines API client for the primary server
 * Handles launching and destroying shard machines on-demand
 */

import { broadcastShards } from "./shardRegistry.ts";

const env = (key: string) =>
  typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;

const FLY_API_TOKEN = env("FLY_API_TOKEN");
const FLY_APP_NAME = env("FLY_APP_NAME") || "est-shards";
const PRIMARY_SERVER = env("PRIMARY_SERVER") || "wss://est.w3x.io";
const FLY_API_BASE = "https://api.machines.dev/v1";

type MachineState =
  | "created"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "replacing"
  | "destroying"
  | "destroyed";

type Machine = {
  id: string;
  name: string;
  state: MachineState;
  region: string;
  instance_id: string;
  private_ip: string;
  config: {
    image: string;
    env: Record<string, string>;
  };
  created_at: string;
  updated_at: string;
};

// Region info from Fly.io API
export type FlyRegion = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  deprecated: boolean;
  requiresPaidPlan: boolean;
};

// Cached regions from API
let cachedRegions: FlyRegion[] | undefined;
let regionsLastFetched = 0;
const REGIONS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// In-flight regions fetch promise (for deduplication)
let fetchingRegions: Promise<FlyRegion[]> | undefined;

// Track machines launched by this server
// Maps machine ID -> { region, launchTime, lobbies }
type ManagedMachine = {
  id: string;
  region: string; // region code
  launchTime: number;
  lobbies: Set<string>; // Lobby IDs using this machine
  shardId?: string; // Set once shard registers
  destroyTimer?: number; // setTimeout ID for delayed destruction
};

const managedMachines = new Map<string, ManagedMachine>();

// Maps region code -> machineId for quick lookup
const regionToMachine = new Map<string, string>();

// Reverse lookup: lobbyId -> machineId. Survives shard disconnects so cleanup
// can still run after a RegisteredShard is gone.
const lobbyToMachine = new Map<string, string>();

// Machines currently launching (region code -> Promise that resolves to machine ID or rejects)
const launchingMachines = new Map<string, Promise<string>>();

export const isFlyEnabled = () => Boolean(FLY_API_TOKEN);

console.log(new Date(), "[Fly]", isFlyEnabled() ? "Enabled" : "Disabled");

const flyRequest = (
  path: string,
  options: RequestInit = {},
): Promise<Response> => {
  if (!FLY_API_TOKEN) throw new Error("FLY_API_TOKEN not configured");

  const url = `${FLY_API_BASE}/apps/${FLY_APP_NAME}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
};

const flyPlatformRequest = (path: string): Promise<Response> => {
  if (!FLY_API_TOKEN) throw new Error("FLY_API_TOKEN not configured");

  const url = `${FLY_API_BASE}${path}`;
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
};

/**
 * Fetch regions from API and update cache.
 * Deduplicates concurrent calls by sharing the in-flight promise.
 */
const fetchFlyRegions = (): Promise<FlyRegion[]> => {
  if (fetchingRegions) return fetchingRegions;

  const doFetch = async (): Promise<FlyRegion[]> => {
    const response = await flyPlatformRequest("/platform/regions");
    if (!response.ok) {
      console.error(
        new Date(),
        `[Fly] Failed to fetch regions: ${await response.text()}`,
      );
      return cachedRegions ?? [];
    }

    const data = await response.json();
    cachedRegions = (data.Regions as Array<{
      code: string;
      name: string;
      latitude: number;
      longitude: number;
      deprecated: boolean;
      requires_paid_plan: boolean;
    }>)
      .filter((r) => !r.deprecated)
      .map((r) => ({
        code: r.code,
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        deprecated: r.deprecated,
        requiresPaidPlan: r.requires_paid_plan,
      }));
    regionsLastFetched = Date.now();

    console.log(
      new Date(),
      `[Fly] Fetched ${cachedRegions.length} regions from API`,
    );
    return cachedRegions;
  };

  fetchingRegions = doFetch().finally(() => {
    fetchingRegions = undefined;
  });

  return fetchingRegions;
};

/**
 * Get Fly.io regions (synchronous). Returns cached data immediately.
 * If data is stale, triggers a background fetch that broadcasts updates when complete.
 */
export const getFlyRegions = (): FlyRegion[] => {
  if (
    isFlyEnabled() &&
    (!cachedRegions || Date.now() - regionsLastFetched >= REGIONS_CACHE_TTL)
  ) {
    fetchFlyRegions().then(() => broadcastShards()).catch((err) => {
      console.error(new Date(), "[Fly] Failed to fetch regions:", err);
    });
  }
  return cachedRegions ?? [];
};

const getMachine = async (machineId: string): Promise<Machine> => {
  const response = await flyRequest(`/machines/${machineId}`);
  if (!response.ok) {
    throw new Error(`Failed to get machine: ${await response.text()}`);
  }
  return response.json();
};

const waitForState = async (
  machineId: string,
  targetState: MachineState,
  timeoutMs = 60000,
): Promise<Machine> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const machine = await getMachine(machineId);
    if (machine.state === targetState) return machine;
    if (machine.state === "destroyed") {
      throw new Error(`Machine was destroyed while waiting for ${targetState}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout waiting for machine to reach state: ${targetState}`);
};

/**
 * Launch a new shard machine in a region.
 * Returns the machine ID once launched and started.
 */
export const launchFlyMachine = async (region: string): Promise<string> => {
  // Check if already launching in this region
  const existing = launchingMachines.get(region);
  if (existing) return existing;

  // Check if we already have a machine in this region
  const existingMachineId = regionToMachine.get(region);
  if (existingMachineId) return existingMachineId;

  const launchPromise = (async () => {
    const shardPort = 8080;

    const config = {
      name: `shard-${region}-${Date.now()}`,
      region,
      config: {
        image: "registry.fly.io/est-shards:latest",
        env: {
          SHARD_NAME: "fly.io",
          SHARD_PORT: String(shardPort),
          PRIMARY_SERVER,
        },
        services: [{
          ports: [
            { port: 443, handlers: ["tls", "http"] },
            { port: 80, handlers: ["http"] },
          ],
          protocol: "tcp",
          internal_port: shardPort,
          concurrency: {
            type: "connections",
            hard_limit: 1000,
            soft_limit: 800,
          },
          http_checks: [{ interval: 10000, timeout: 2000, path: "/health" }],
        }],
        guest: { cpu_kind: "shared", cpus: 1, memory_mb: 512 },
        restart: { policy: "on-failure", max_retries: 3 },
      },
    };

    console.log(new Date(), `[Fly] Launching machine in ${region}...`);
    const response = await flyRequest("/machines", {
      method: "POST",
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to launch machine: ${await response.text()}`);
    }

    const machine: Machine = await response.json();
    console.log(
      new Date(),
      `[Fly] Created machine ${machine.id}, waiting for start...`,
    );

    // Wait for machine to be running
    await waitForState(machine.id, "started");
    console.log(new Date(), `[Fly] Machine ${machine.id} started in ${region}`);

    // Track this machine
    managedMachines.set(machine.id, {
      id: machine.id,
      region,
      launchTime: Date.now(),
      lobbies: new Set(),
    });
    regionToMachine.set(region, machine.id);

    return machine.id;
  })();

  // Set synchronously BEFORE awaiting so broadcastShards() sees it immediately
  launchingMachines.set(region, launchPromise);

  try {
    return await launchPromise;
  } finally {
    launchingMachines.delete(region);
  }
};

/**
 * Check if a region is currently launching
 */
export const isFlyRegionLaunching = (region: string): boolean =>
  launchingMachines.has(region);

/**
 * Get the machine ID for a region if one exists
 */
export const getFlyMachineForRegion = (region: string): string | undefined =>
  regionToMachine.get(region);

/**
 * Associate a lobby with a machine
 */
export const addLobbyToFlyMachine = (machineId: string, lobbyId: string) => {
  const machine = managedMachines.get(machineId);
  if (!machine) return;

  machine.lobbies.add(lobbyId);
  lobbyToMachine.set(lobbyId, machineId);

  // Cancel any pending destruction
  if (machine.destroyTimer) {
    console.log(
      new Date(),
      `[Fly] Machine ${machineId} destruction canceled (lobby ${lobbyId} added)`,
    );
    clearTimeout(machine.destroyTimer);
    machine.destroyTimer = undefined;
  }
};

/**
 * Remove a lobby from a machine and schedule destruction if no lobbies remain.
 * Looks up the machine via the reverse map if `machineId` is omitted, so cleanup
 * works even after the RegisteredShard is gone.
 */
export const removeLobbyFromFlyMachine = (
  machineIdOrUndefined: string | undefined,
  lobbyId: string,
) => {
  const machineId = machineIdOrUndefined ?? lobbyToMachine.get(lobbyId);
  if (!machineId) return;
  const machine = managedMachines.get(machineId);
  lobbyToMachine.delete(lobbyId);
  if (!machine) return;

  machine.lobbies.delete(lobbyId);

  // If no lobbies, schedule destruction after buffer period
  if (machine.lobbies.size === 0 && !machine.destroyTimer) {
    const DESTROY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    console.log(
      new Date(),
      `[Fly] Machine ${machineId} has no lobbies, scheduling destruction in 5 minutes`,
    );

    machine.destroyTimer = setTimeout(() => {
      destroyFlyMachine(machineId);
    }, DESTROY_BUFFER_MS);
  }
};

const sendDestroyRequest = async (machineId: string): Promise<boolean> => {
  try {
    const response = await flyRequest(`/machines/${machineId}?force=true`, {
      method: "DELETE",
    });
    if (response.ok || response.status === 404) return true;
    console.error(
      new Date(),
      `[Fly] Destroy ${machineId} returned ${response.status}: ${await response
        .text()}`,
    );
    return false;
  } catch (err) {
    console.error(
      new Date(),
      `[Fly] Network error destroying ${machineId}:`,
      err,
    );
    return false;
  }
};

const untrackMachine = (machineId: string) => {
  const machine = managedMachines.get(machineId);
  if (!machine) return;
  if (machine.destroyTimer) clearTimeout(machine.destroyTimer);
  for (const lobbyId of machine.lobbies) lobbyToMachine.delete(lobbyId);
  managedMachines.delete(machineId);
  if (regionToMachine.get(machine.region) === machineId) {
    regionToMachine.delete(machine.region);
  }
};

/**
 * Destroy a machine. DELETE first, then untrack only on success — failures
 * leave the machine in `managedMachines` so the periodic reconciliation loop
 * (or a subsequent destroy) can retry.
 */
export const destroyFlyMachine = async (machineId: string) => {
  console.log(new Date(), `[Fly] Destroying machine ${machineId}...`);
  const ok = await sendDestroyRequest(machineId);
  if (ok) {
    console.log(new Date(), `[Fly] Machine ${machineId} destroyed`);
    untrackMachine(machineId);
  } else {
    console.warn(
      new Date(),
      `[Fly] Destroy ${machineId} failed; will retry via reconciliation`,
    );
  }
};

/**
 * Associate a shard ID with a machine (called when shard registers)
 */
export const setShardIdForFlyMachine = (
  machineId: string,
  shardId: string,
) => {
  const machine = managedMachines.get(machineId);
  if (machine) {
    machine.shardId = shardId;
    // Re-establish region mapping if shard reconnected
    if (!regionToMachine.has(machine.region)) {
      regionToMachine.set(machine.region, machineId);
    }

    // If shard registers with no lobbies, schedule destruction
    // This handles the case where all launch retries failed
    if (machine.lobbies.size === 0 && !machine.destroyTimer) {
      const DESTROY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
      console.log(
        new Date(),
        `[Fly] Machine ${machineId} registered with no lobbies, scheduling destruction in 5 minutes`,
      );

      machine.destroyTimer = setTimeout(() => {
        destroyFlyMachine(machineId);
      }, DESTROY_BUFFER_MS);
    }
  }
};

/**
 * Get the machine ID for a shard
 */
export const getFlyMachineIdForShard = (
  shardId: string,
): string | undefined => {
  for (const [machineId, machine] of managedMachines) {
    if (machine.shardId === shardId) return machineId;
  }
  return undefined;
};

/**
 * Get the region code for a machine
 */
export const getFlyRegionForMachine = (
  machineId: string,
): string | undefined => managedMachines.get(machineId)?.region;

const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;
const RECONCILE_MIN_AGE_MS = 10 * 60 * 1000;

const listAllMachines = async (): Promise<Machine[]> => {
  const response = await flyRequest("/machines");
  if (!response.ok) {
    throw new Error(`List machines failed: ${await response.text()}`);
  }
  return response.json();
};

const isLiveState = (state: MachineState) =>
  state === "created" || state === "starting" || state === "started" ||
  state === "stopping" || state === "stopped";

/**
 * Periodic reconciliation against the Fly API. Treats in-memory state as a
 * cache; destroys any machine that:
 *  - exists in Fly but not in `managedMachines` (orphaned by a primary restart), or
 *  - is tracked but has no lobbies, no active destroy timer, and is older than
 *    RECONCILE_MIN_AGE_MS (covers timers lost to process exit / failed cleanup).
 */
const reconcileFlyMachines = async () => {
  let machines: Machine[];
  try {
    machines = await listAllMachines();
  } catch (err) {
    console.error(new Date(), "[Fly] Reconciliation list failed:", err);
    return;
  }

  const seen = new Set<string>();
  for (const m of machines) {
    seen.add(m.id);
    if (!isLiveState(m.state)) continue;

    const tracked = managedMachines.get(m.id);
    if (!tracked) {
      console.warn(
        new Date(),
        `[Fly] Reconciliation: orphan machine ${m.id} (${m.region}, ${m.state}) — destroying`,
      );
      await destroyFlyMachine(m.id);
      continue;
    }

    const ageMs = Date.now() - tracked.launchTime;
    if (
      tracked.lobbies.size === 0 && !tracked.destroyTimer &&
      ageMs > RECONCILE_MIN_AGE_MS
    ) {
      console.warn(
        new Date(),
        `[Fly] Reconciliation: idle machine ${m.id} (no lobbies, no timer, age ${
          Math.round(ageMs / 1000)
        }s) — destroying`,
      );
      await destroyFlyMachine(m.id);
    }
  }

  // Drop tracking for machines Fly no longer reports as live.
  for (const machineId of [...managedMachines.keys()]) {
    if (!seen.has(machineId)) {
      console.warn(
        new Date(),
        `[Fly] Reconciliation: tracked machine ${machineId} not found in Fly — clearing local state`,
      );
      untrackMachine(machineId);
    }
  }
};

let reconcileTimer: number | undefined;

export const startFlyReconciliation = () => {
  if (!isFlyEnabled() || reconcileTimer !== undefined) return;
  // Run once on startup (catches restart-orphans immediately), then on interval.
  reconcileFlyMachines().catch((err) =>
    console.error(new Date(), "[Fly] Reconciliation crashed:", err)
  );
  reconcileTimer = setInterval(() => {
    reconcileFlyMachines().catch((err) =>
      console.error(new Date(), "[Fly] Reconciliation crashed:", err)
    );
  }, RECONCILE_INTERVAL_MS);
};

/**
 * Handle a shard disconnecting - clear shard association, explicitly remove
 * each lobby from the machine (so the destruction timer starts), and keep the
 * machine entry around so the timer can fire.
 */
export const onFlyShardDisconnected = (shardId: string, lobbyIds: string[]) => {
  const machineId = getFlyMachineIdForShard(shardId);
  if (!machineId) return;
  const machine = managedMachines.get(machineId);
  if (!machine) return;

  for (const lobbyId of lobbyIds) {
    removeLobbyFromFlyMachine(machineId, lobbyId);
  }

  // Clear shard association but keep machine tracking for destruction timer
  machine.shardId = undefined;
  // Clear region mapping so a new shard can be launched if needed
  if (regionToMachine.get(machine.region) === machineId) {
    regionToMachine.delete(machine.region);
  }
};
