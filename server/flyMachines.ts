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
 * Fetch regions from API and update cache
 */
const fetchFlyRegions = async (): Promise<FlyRegion[]> => {
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
 * Remove a lobby from a machine and schedule destruction if no lobbies remain
 */
export const removeLobbyFromFlyMachine = (
  machineId: string,
  lobbyId: string,
) => {
  const machine = managedMachines.get(machineId);
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

/**
 * Destroy a machine
 */
export const destroyFlyMachine = async (machineId: string) => {
  const machine = managedMachines.get(machineId);
  if (!machine) return;

  // Clear timer if set
  if (machine.destroyTimer) {
    clearTimeout(machine.destroyTimer);
  }

  // Clean up tracking
  managedMachines.delete(machineId);
  regionToMachine.delete(machine.region);

  console.log(new Date(), `[Fly] Destroying machine ${machineId}...`);
  try {
    const response = await flyRequest(`/machines/${machineId}?force=true`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.error(
        new Date(),
        `[Fly] Failed to destroy machine ${machineId}: ${await response
          .text()}`,
      );
    } else {
      console.log(new Date(), `[Fly] Machine ${machineId} destroyed`);
    }
  } catch (err) {
    console.error(
      new Date(),
      `[Fly] Error destroying machine ${machineId}:`,
      err,
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

/**
 * Handle a shard disconnecting - clear shard association but keep machine tracking
 * so destruction timers can still fire
 */
export const onFlyShardDisconnected = (shardId: string) => {
  const machineId = getFlyMachineIdForShard(shardId);
  if (machineId) {
    const machine = managedMachines.get(machineId);
    if (machine) {
      // Clear shard association but keep machine tracking for destruction timer
      machine.shardId = undefined;
      // Clear region mapping so a new shard can be launched if needed
      regionToMachine.delete(machine.region);
    }
  }
};
