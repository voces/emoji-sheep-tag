import type { Socket } from "./client.ts";
import type {
  ServerToShardMessage,
  ShardInfo,
  ShardToServerMessage,
} from "@/shared/shard.ts";
import { zShardToServerMessage } from "@/shared/shard.ts";
import { undoDraft } from "./st/roundHelpers.ts";
import { lobbyContext } from "./contexts.ts";
import { lobbies, type Lobby } from "./lobby.ts";
import { processRoundEnd, send, sendRoundEndMessages } from "./lobbyApi.ts";
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
  haversineDistance,
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

const sendShardListToLobby = (lobby: Lobby, regions: FlyRegion[]) => {
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
};

/**
 * Broadcast updated shard list.
 * If lobby is provided, only broadcasts to that lobby.
 * If lobby is omitted, broadcasts to all lobbies (for global shard changes).
 */
export const broadcastShards = (lobby?: Lobby) => {
  const regions = getFlyRegions();
  if (lobby) {
    sendShardListToLobby(lobby, regions);
  } else {
    for (const l of lobbies) {
      sendShardListToLobby(l, regions);
    }
  }
};

/**
 * Fetch geolocation for a client's IP and broadcast updated shard list.
 * Call this when a client joins a lobby to ensure sorting is based on player locations.
 * Always broadcasts immediately (player set changed), and fetches geo async if not cached.
 */
export const fetchClientGeoAndBroadcast = (client: Client) => {
  const lobby = client.lobby;
  if (!lobby) return;

  // Always broadcast when player set changes (for auto-select)
  broadcastShards(lobby);

  // If no IP or already cached, nothing more to do
  if (!client.ip || getIpCoordinates(client.ip)) return;

  // Fetch geo in background and broadcast again when complete
  fetchIpCoordinates(client.ip).then((coords) => {
    if (coords && client.lobby) {
      broadcastShards(client.lobby);
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

/** End a round that was running on a shard */
const endShardRound = (
  lobbyId: string,
  options: {
    canceled?: boolean;
    practice?: boolean;
    sheepWon?: boolean;
    round?: { sheep: string[]; wolves: string[]; duration: number };
    cancelMessage?: string;
  },
) => {
  const lobby = Array.from(lobbies).find((l) => l.name === lobbyId);
  if (!lobby) {
    console.log(
      new Date(),
      `[Shard] endShardRound: lobby ${lobbyId} not found`,
    );
    return;
  }
  if (lobby.status !== "playing") {
    console.log(
      new Date(),
      `[Shard] endShardRound: lobby ${lobbyId} status is ${lobby.status}, expected playing`,
    );
    return;
  }

  lobbyContext.with(lobby, () => {
    if (options.canceled && lobby.settings.mode !== "switch") {
      undoDraft();
    }

    const { captainsPhaseChanged, inSecondCaptainsRound } = processRoundEnd(
      lobby,
      options.canceled ?? false,
      options.practice ?? false,
    );

    lobby.status = "lobby";
    lobby.activeShard = undefined;

    // Record round result and update sheep counts if not canceled
    if (options.round && !options.canceled) {
      lobby.rounds.push(options.round);

      if (lobby.settings.mode !== "switch") {
        for (const playerId of options.round.sheep) {
          const player = Array.from(lobby.players).find((p) =>
            p.id === playerId
          );
          if (player) {
            player.sheepCount = (player.sheepCount ?? 0) + 1;
          }
        }
      }
    }

    sendRoundEndMessages(
      options.round,
      captainsPhaseChanged,
      inSecondCaptainsRound,
      {
        canceled: options.canceled ?? false,
        practice: options.practice ?? false,
        sheepWon: options.sheepWon,
        cancelMessage: options.cancelMessage,
      },
    );
  });
};

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
            // Use short display name for consistency with pre-launch region names
            region = getRegionDisplayName(
              regionCode,
              flyRegion?.name ?? regionCode,
            );
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

        endShardRound(message.lobbyId, {
          canceled: message.canceled,
          practice: message.practice,
          sheepWon: message.sheepWon,
          round: message.round,
        });

        console.log(
          new Date(),
          `[Shard] Lobby ${message.lobbyId} ended on shard ${shard.name}${
            message.canceled ? " (canceled)" : ""
          }`,
        );
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

      // End rounds for all lobbies that were playing on this shard
      for (const lobbyId of shard.lobbies) {
        endShardRound(lobbyId, {
          canceled: true,
          cancelMessage: `Round canceled (${shard.name} disconnected).`,
        });
        console.log(
          new Date(),
          `[Shard] Round ended in ${lobbyId} due to shard disconnect`,
        );
      }

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

// Override Fly.io region names (code -> display name)
const REGION_NAME_OVERRIDES: Record<string, string> = {
  ams: "Amsterdam",
  arn: "Stockholm",
  bom: "Mumbai",
  cdg: "Paris",
  dfw: "Dallas",
  ewr: "New York",
  fra: "Frankfurt",
  gru: "Sao Paulo",
  iad: "Washington DC",
  jnb: "Johannesburg",
  lax: "Los Angeles",
  lhr: "London",
  nrt: "Tokyo",
  ord: "Chicago",
  sin: "Singapore",
  sjc: "San Jose",
  yyz: "Toronto",
};

const getRegionDisplayName = (code: string, defaultName: string): string =>
  REGION_NAME_OVERRIDES[code] ?? defaultName;

/** Get display name for a Fly.io region code (e.g., "lax" -> "Los Angeles") */
export const getFlyRegionDisplayName = (code: string): string =>
  REGION_NAME_OVERRIDES[code] ?? code.toUpperCase();

const buildShardInfoList = (
  regions: FlyRegion[],
  playerCoordinates?: Coordinates[],
): ShardInfo[] => {
  const result: ShardInfoWithCoords[] = [];

  // Add primary server
  result.push({
    id: "",
    name: "est.w3x.io",
    region: "Columbus",
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
        region: getRegionDisplayName(region.code, region.name),
        playerCount: 0,
        lobbyCount: 0,
        isOnline: false,
        flyRegion: region.code,
        status: launching ? "launching" : "offline",
        coordinates: { lat: region.latitude, lon: region.longitude },
      });
    }
  }

  // Sort by summed distance to players if we have player coordinates
  if (playerCoordinates && playerCoordinates.length > 0) {
    const summedDistance = (coords: Coordinates | undefined): number => {
      if (!coords) return Infinity;
      return playerCoordinates.reduce(
        (sum, pc) => sum + haversineDistance(coords, pc) ** 2,
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
