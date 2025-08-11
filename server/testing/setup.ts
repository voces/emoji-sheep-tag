import { newEcs } from "../ecs.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newLobby } from "../lobby.ts";
import { interval } from "../api/timing.ts";
import { init } from "../st/data.ts";

export type TestSetupOptions = {
  wolves?: string[];
  sheep?: string[];
  gold?: number;
};

export type TestSetup = {
  ecs: ReturnType<typeof newEcs>;
  lobby: ReturnType<typeof newLobby>;
  clients: Map<string, Client>;
};

/**
 * Creates a test setup with ECS, lobby, and clients
 * @param options Configuration for wolves, sheep, and starting gold
 * @returns Test setup with ecs, lobby, and clients map
 */
export const createTestSetup = (options: TestSetupOptions = {}): TestSetup => {
  const { wolves = [], sheep = [], gold = 10 } = options;

  const ecs = newEcs();
  const clients = new Map<string, Client>();

  // Create wolf clients
  const wolfClients = wolves.map((playerId) => {
    const client = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    client.id = playerId;
    client.name = playerId; // Set name for playerEntity creation
    clients.set(playerId, client);
    return { client };
  });

  // Create sheep clients
  const sheepClients = sheep.map((playerId) => {
    const client = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    client.id = playerId;
    client.name = playerId; // Set name for playerEntity creation
    clients.set(playerId, client);
    return { client };
  });

  // Set up default client context (uses first client or creates test client)
  const firstClient = clients.values().next().value;
  if (firstClient) {
    clientContext.context = firstClient;
  } else {
    const testClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    testClient.id = "test-client";
    clientContext.context = testClient;
  }

  // Set up lobby
  const lobby = newLobby();
  lobby.settings = {
    teams: new Map(),
    startingGold: {
      sheep: gold,
      wolves: gold,
    },
  };
  lobbyContext.context = lobby;
  lobby.round = {
    sheep: new Set(sheepClients.map((s) => s.client)),
    wolves: new Set(wolfClients.map((w) => w.client)),
    ecs,
    start: Date.now(),
    clearInterval: interval(() => ecs.update(), 0.05),
  };

  // Initialize game data
  init({
    sheep: sheepClients,
    wolves: wolfClients,
  });

  // Create player entities (similar to start action)
  for (const { client } of sheepClients) {
    client.playerEntity = ecs.addEntity({
      name: client.name,
      owner: client.id,
      isPlayer: true,
      gold: gold,
    });
  }

  for (const { client } of wolfClients) {
    client.playerEntity = ecs.addEntity({
      name: client.name,
      owner: client.id,
      isPlayer: true,
      gold: gold,
    });
  }

  return { ecs, lobby, clients };
};

/**
 * Standard cleanup to run in afterEach
 */
export const cleanupTest = () => {
  try {
    lobbyContext.context?.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.context = undefined;
  clientContext.context = undefined;
};
