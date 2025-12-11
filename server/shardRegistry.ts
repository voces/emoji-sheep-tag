import type { Socket } from "./client.ts";
import type {
  ServerToShardMessage,
  ShardInfo,
  ShardToServerMessage,
} from "@/shared/shard.ts";
import { zShardToServerMessage } from "@/shared/shard.ts";
import { undoDraft } from "./st/roundHelpers.ts";
import { lobbyContext } from "./contexts.ts";
import { lobbies } from "./lobby.ts";
import { send } from "./lobbyApi.ts";
import { serializeLobbySettings } from "./actions/lobbySettings.ts";
import {
  type FlyRegion,
  getFlyMachineForRegion,
  getFlyRegionForMachine,
  getFlyRegions,
  isFlyEnabled,
  isFlyRegionLaunching,
  onFlyShardDisconnected,
  removeLobbyFromFlyMachine,
  setShardIdForFlyMachine,
} from "./flyMachines.ts";
import {
  type Coordinates,
  fetchIpCoordinates,
  geolocateIp,
  getIpCoordinates,
  squaredDistance,
} from "./util/geolocation.ts";
import type { Client } from "./client.ts";

type RegisteredShard = {
  id: string;
  name: string;
  region?: string;
  coordinates?: Coordinates;
  publicUrl: string;
  socket: Socket;
  lobbyCount: number;
  playerCount: number;
  lobbies: Set<string>; // Lobby IDs assigned to this shard
  flyMachineId?: string; // If this shard is on a Fly.io machine
};

const shards = new Map<string, RegisteredShard>();
let shardIndex = 0;

/** Check if a shard ID is valid (either a registered shard or a fly region) */
export const isValidShardId = (id: string): boolean =>
  shards.has(id) || (isFlyEnabled() && id.startsWith("fly:"));

const sendShardListToLobbies = () => {
  const regions = getFlyRegions();

  for (const lobby of lobbies) {
    lobbyContext.with(lobby, () => {
      let settingsChanged = false;

      // If lobby has a fly region selected, check if there's now a real shard for it
      if (lobby.settings.shard?.startsWith("fly:")) {
        const regionCode = lobby.settings.shard.slice(4);
        const machineId = getFlyMachineForRegion(regionCode);
        if (machineId) {
          const shard = getShardByMachineId(machineId);
          if (shard) {
            // Upgrade from fly region to actual shard
            lobby.settings.shard = shard.id;
            settingsChanged = true;
          }
        }
      }

      // If lobby's shard no longer exists, clear it
      if (lobby.settings.shard && !isValidShardId(lobby.settings.shard)) {
        lobby.settings.shard = undefined;
        settingsChanged = true;
      }

      // Collect player coordinates for sorting
      const playerCoordinates: Coordinates[] = [];
      for (const player of lobby.players) {
        if (player.ip) {
          const coords = getIpCoordinates(player.ip);
          if (coords) playerCoordinates.push(coords);
        }
      }

      const shardList = buildShardInfoList(regions, playerCoordinates);

      // Auto-select best shard if enabled and we have player coordinates
      if (lobby.settings.shardAutoSelect && playerCoordinates.length > 0) {
        const bestShard = shardList[0];
        if (bestShard && (lobby.settings.shard ?? "") !== bestShard.id) {
          lobby.settings.shard = bestShard.id || undefined;
          settingsChanged = true;
        }
      }

      if (settingsChanged) {
        send({ type: "lobbySettings", ...serializeLobbySettings(lobby) });
      } else {
        send({ type: "shards", shards: shardList });
      }
    });
  }
};

/** Broadcast updated shard list to all lobby clients */
export const broadcastShards = () => {
  sendShardListToLobbies();
};

/**
 * Fetch geolocation for a client's IP and broadcast updated shard list if new data.
 * Call this when a client joins a lobby to ensure sorting is based on player locations.
 */
export const fetchClientGeoAndBroadcast = (client: Client) => {
  if (!client.ip || !client.lobby) return;

  // Check if already cached
  if (getIpCoordinates(client.ip)) return;

  // Fetch in background and broadcast when complete
  fetchIpCoordinates(client.ip).then((coords) => {
    if (coords && client.lobby) {
      broadcastShards();
    }
  }).catch(() => {
    // Geolocation is best-effort
  });
};

export const sendToShard = (
  shard: RegisteredShard,
  message: ServerToShardMessage,
) => {
  if (shard.socket.readyState !== WebSocket.OPEN) return;
  try {
    shard.socket.send(JSON.stringify(message));
  } catch (err) {
    console.error("[Shard] Error sending to shard:", err);
  }
};

const validateShardConnectivity = (
  publicUrl: string,
  timeout = 5000,
): Promise<string | null> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.close();
      resolve("Connection timeout");
    }, timeout);

    const healthUrl = new URL(publicUrl);
    healthUrl.searchParams.set("healthcheck", "1");
    const ws = new WebSocket(healthUrl.toString());

    ws.addEventListener("open", () => {
      clearTimeout(timer);
      ws.close();
      resolve(null);
    });

    ws.addEventListener("error", () => {
      clearTimeout(timer);
      resolve("Connection failed - shard may not be reachable");
    });
  });

export const handleShardSocket = (
  socket: Socket,
  remoteIp: string,
  primaryIsSecure: boolean,
) => {
  let shard: RegisteredShard | undefined;

  socket.addEventListener("message", async (e) => {
    if (typeof e.data !== "string") return;

    let message: ShardToServerMessage;
    try {
      message = zShardToServerMessage.parse(JSON.parse(e.data));
    } catch (err) {
      console.error("[Shard] Invalid message from shard:", err);
      return;
    }

    switch (message.type) {
      case "register": {
        // Derive public URL - use same scheme as primary server
        const scheme = primaryIsSecure ? "wss" : "ws";
        // For IPv6, wrap in brackets; don't include port for standard ports (443/80)
        const ipForUrl = remoteIp.includes(":") ? `[${remoteIp}]` : remoteIp;
        const publicUrl = message.publicUrl ??
          `${scheme}://${ipForUrl}:${message.port}`;

        // Check if this is a Fly.io machine (has ?machine= param)
        let flyMachineId: string | undefined;
        try {
          const urlObj = new URL(publicUrl);
          const machineParam = urlObj.searchParams.get("machine");
          if (machineParam && urlObj.hostname.endsWith(".fly.dev")) {
            flyMachineId = machineParam;
          }
        } catch {
          // Not a valid URL, ignore
        }

        // Derive name from provided name, publicUrl hostname, or remote IP
        const deriveHostname = () => {
          try {
            return new URL(publicUrl).hostname;
          } catch {
            return remoteIp;
          }
        };
        const name = message.name ?? deriveHostname();

        // Validate connectivity before accepting registration
        console.log(
          new Date(),
          `[Shard] Validating shard connectivity at ${publicUrl}...`,
        );

        const validationError = await validateShardConnectivity(publicUrl);
        if (validationError) {
          console.log(
            new Date(),
            `[Shard] Shard ${name} rejected: ${validationError}`,
          );
          sendToShard({ socket } as RegisteredShard, {
            type: "rejected",
            reason: validationError,
          });
          return;
        }

        // Look up region - use Fly.io region for managed machines, otherwise IP geolocation
        let region: string | undefined;
        let coordinates: Coordinates | undefined;
        if (flyMachineId) {
          const regionCode = getFlyRegionForMachine(flyMachineId);
          if (regionCode) {
            const flyRegion = getFlyRegions().find((r) =>
              r.code === regionCode
            );
            region = flyRegion?.name ?? regionCode;
            if (flyRegion) {
              coordinates = {
                lat: flyRegion.latitude,
                lon: flyRegion.longitude,
              };
            }
          }
        }
        if (!region) {
          const geo = await geolocateIp(remoteIp);
          region = geo.name;
          coordinates = geo.coordinates;
        }

        // Ensure unique name+region combination
        const isNameTaken = (n: string) =>
          Array.from(shards.values()).some((s) =>
            s.name === n && s.region === region
          );

        let uniqueName = name;
        if (isNameTaken(uniqueName)) {
          let counter = 2;
          while (isNameTaken(`${name} ${counter}`)) counter++;
          uniqueName = `${name} ${counter}`;
        }

        const id = `shard-${shardIndex++}`;
        shard = {
          id,
          name: uniqueName,
          region,
          coordinates,
          publicUrl,
          socket,
          lobbyCount: 0,
          playerCount: 0,
          lobbies: new Set(),
          flyMachineId,
        };
        shards.set(id, shard);

        // Link to Fly machine tracking if this is a managed machine
        if (flyMachineId) {
          setShardIdForFlyMachine(flyMachineId, id);
        }

        console.log(
          new Date(),
          `[Shard] Shard registered: ${shard.name} (${id}) at ${publicUrl}${
            flyMachineId ? ` [fly:${flyMachineId}]` : ""
          }`,
        );

        sendToShard(shard, { type: "registered", shardId: id });
        broadcastShards();
        break;
      }

      case "status": {
        if (!shard) return;
        shard.lobbyCount = message.lobbies;
        shard.playerCount = message.players;
        break;
      }

      case "lobbyEnded": {
        if (!shard) return;
        shard.lobbies.delete(message.lobbyId);

        // Clean up Fly machine tracking
        if (shard.flyMachineId) {
          removeLobbyFromFlyMachine(shard.flyMachineId, message.lobbyId);
        }

        // Find the lobby on the primary server
        const lobby = Array.from(lobbies).find(
          (l) => l.name === message.lobbyId,
        );
        if (lobby && lobby.status === "playing") {
          lobbyContext.with(lobby, () => {
            if (message.canceled && lobby.settings.mode !== "switch") {
              undoDraft();
            }

            // Reset lobby status (shard games don't have lobby.round on primary)
            lobby.status = "lobby";

            // Record round result if not canceled
            if (message.round && !message.canceled) {
              lobby.rounds.push(message.round);
            }

            // Notify clients (shard already sent stop, but primary clients need update)
            if (message.canceled) {
              for (const p of lobby.players) {
                p.send({ type: "chat", message: "Round canceled." });
              }
            }
          });

          console.log(
            new Date(),
            `[Shard] Lobby ${message.lobbyId} ended on shard ${shard.name}${
              message.canceled ? " (canceled)" : ""
            }`,
          );
        }
        break;
      }
    }
  });

  socket.addEventListener("close", () => {
    if (shard) {
      console.log(
        new Date(),
        `[Shard] Shard disconnected: ${shard.name} (${shard.id})`,
      );
      shards.delete(shard.id);

      // Clean up Fly machine tracking
      if (shard.flyMachineId) {
        onFlyShardDisconnected(shard.id);
      }

      broadcastShards();
    }
  });
};

export const getShards = (): RegisteredShard[] => Array.from(shards.values());

export const getShard = (id: string): RegisteredShard | undefined =>
  shards.get(id);

type ShardInfoWithCoords = ShardInfo & { coordinates?: Coordinates };

// Primary server coordinates (Columbus, OH)
const PRIMARY_SERVER_COORDS: Coordinates = { lat: 40.0992, lon: -83.1141 };

const buildShardInfoList = (
  regions: FlyRegion[],
  playerCoordinates?: Coordinates[],
): ShardInfo[] => {
  const result: ShardInfoWithCoords[] = [];

  // Add primary server
  result.push({
    id: "",
    name: "est.w3x.io",
    region: "Dublin, Ohio (US)",
    playerCount: 0,
    lobbyCount: 0,
    isOnline: true,
    coordinates: PRIMARY_SERVER_COORDS,
  });

  // Add registered shards
  for (const s of shards.values()) {
    result.push({
      id: s.id,
      name: s.name,
      region: s.region,
      playerCount: s.playerCount,
      lobbyCount: s.lobbyCount,
      isOnline: s.socket.readyState === WebSocket.OPEN,
      coordinates: s.coordinates,
    });
  }

  // Add Fly.io regions (if enabled)
  if (isFlyEnabled()) {
    for (const region of regions) {
      // Check if there's already an online shard for this region
      const existingMachineId = getFlyMachineForRegion(region.code);
      if (existingMachineId) {
        // There's a machine, check if shard is registered
        const existingShard = Array.from(shards.values()).find(
          (s) => s.flyMachineId === existingMachineId,
        );
        if (existingShard) {
          // Shard is already in the list, skip adding fly region entry
          continue;
        }
      }

      // Determine status
      const launching = isFlyRegionLaunching(region.code);

      result.push({
        id: `fly:${region.code}`,
        name: "fly.io",
        region: region.name,
        playerCount: 0,
        lobbyCount: 0,
        isOnline: false,
        flyRegion: region.code,
        status: launching ? "launching" : "offline",
        coordinates: { lat: region.latitude, lon: region.longitude },
      });
    }
  }

  // Sort by summed squared distance to players if we have player coordinates
  if (playerCoordinates && playerCoordinates.length > 0) {
    const summedDistance = (coords: Coordinates | undefined): number => {
      if (!coords) return Infinity;
      return playerCoordinates.reduce(
        (sum, pc) => sum + squaredDistance(coords, pc),
        0,
      );
    };

    result.sort((a, b) =>
      summedDistance(a.coordinates) - summedDistance(b.coordinates)
    );
  }

  // Remove coordinates from final result (not part of ShardInfo)
  return result.map(({ coordinates: _, ...info }) => info);
};

/** Get shard info list (triggers background refresh if regions are stale) */
export const getShardInfoList = (
  lobby?: { players: Set<Client> },
): ShardInfo[] => {
  // Collect player coordinates from lobby if provided
  const playerCoordinates: Coordinates[] = [];
  if (lobby) {
    for (const player of lobby.players) {
      if (player.ip) {
        const coords = getIpCoordinates(player.ip);
        if (coords) playerCoordinates.push(coords);
      }
    }
  }
  return buildShardInfoList(getFlyRegions(), playerCoordinates);
};

/** Get a shard by ID, including fly region lookup */
export const getShardOrFlyRegion = (
  id: string,
): { shard: RegisteredShard } | { flyRegion: string } | undefined => {
  // Check for registered shard first
  const shard = shards.get(id);
  if (shard) return { shard };

  // Check for fly region
  if (id.startsWith("fly:")) {
    const regionCode = id.slice(4);

    // Check if there's already a running shard for this region
    const existingMachineId = getFlyMachineForRegion(regionCode);
    if (existingMachineId) {
      const existingShard = getShardByMachineId(existingMachineId);
      if (existingShard) return { shard: existingShard };
    }

    // Region validity will be checked when actually launching
    return { flyRegion: regionCode };
  }

  return undefined;
};

/** Get a shard by its Fly machine ID */
export const getShardByMachineId = (
  machineId: string,
): RegisteredShard | undefined =>
  Array.from(shards.values()).find((s) => s.flyMachineId === machineId);

/** Wait for a shard to register for a given machine ID */
export const waitForShardByMachineId = (
  machineId: string,
  timeoutMs = 30000,
): Promise<RegisteredShard> =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const shard = getShardByMachineId(machineId);
      if (shard) {
        resolve(shard);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for shard to register for machine ${machineId}`,
          ),
        );
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
