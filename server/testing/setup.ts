import { it as baseIt } from "jsr:@std/testing/bdd";
import { newEcs } from "../ecs.ts";
import { Client } from "../client.ts";
import { clientContext, lobbyContext } from "../contexts.ts";
import { newLobby } from "../lobby.ts";
import { FakeTime } from "jsr:@std/testing/time";
import { appContext } from "@/shared/context.ts";

export type TestSetupOptions = {
  wolves?: string[];
  sheep?: string[];
  gold?: number;
};

export type TestSetup = {
  ecs: ReturnType<typeof newEcs>;
  lobby: ReturnType<typeof newLobby>;
  clients: Map<string, Client>;
  tick: (count?: number) => void;
} & Disposable;

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
    clientContext.current = firstClient;
  } else {
    const testClient = new Client({
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: () => {},
    });
    testClient.id = "test-client";
    clientContext.current = testClient;
  }

  // Set up lobby
  const lobby = newLobby();
  lobby.settings = {
    teams: new Map(),
    time: "auto",
    startingGold: {
      sheep: gold,
      wolves: gold,
    },
  };
  lobbyContext.current = lobby;
  lobby.round = {
    sheep: new Set(sheepClients.map((s) => s.client)),
    wolves: new Set(wolfClients.map((w) => w.client)),
    ecs,
    start: Date.now(),
    clearInterval: () => {},
    practice: false,
  };
  appContext.current = ecs;

  const time = new FakeTime();

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

  return {
    ecs,
    lobby,
    clients,
    tick: (count: number = 1) => {
      while (count--) {
        time.tick(50);
        ecs.update(0.05);
      }
    },
    [Symbol.dispose]: () => time.restore(),
  };
};

/**
 * Standard cleanup to run in afterEach
 */
export const cleanupTest = () => {
  try {
    lobbyContext.current?.round?.clearInterval();
  } catch { /* do nothing */ }
  lobbyContext.current = undefined;
  clientContext.current = undefined;
  appContext.current = undefined;
};

// Generator-based test wrapper types and implementation
export type TestContext = {
  ecs: ReturnType<typeof createTestSetup>["ecs"];
  clients: ReturnType<typeof createTestSetup>["clients"];
  lobby: ReturnType<typeof createTestSetup>["lobby"];
};

export type TestFn = (
  context: TestContext,
) => Generator<void, void, unknown> | void;

/**
 * Generator-based test wrapper that automatically handles ecs.batch() calls
 * and runs ECS updates between yield points to trigger system processing.
 *
 * Usage:
 * ```typescript
 * it("test name", function* ({ ecs }) {
 *   const unit = newUnit("player", "wolf", 0, 0);
 *   unit.health = 50;
 *   yield; // Batch boundary - runs ecs.update()
 *
 *   expect(unit.health).toBe(50);
 * });
 * ```
 *
 * Supports `.only` for running individual tests:
 * ```typescript
 * it.only("run only this test", function* ({ ecs }) {
 *   // This test will run in isolation
 * });
 * ```
 */
function createItImpl(itFn: typeof baseIt | typeof baseIt.only) {
  function itImpl(name: string, testFn: TestFn): void;
  function itImpl(
    name: string,
    setupOptions: TestSetupOptions,
    testFn: TestFn,
  ): void;
  function itImpl(
    name: string,
    setupOptionsOrTestFn: TestSetupOptions | TestFn,
    testFn?: TestFn,
  ) {
    let setupOptions: TestSetupOptions;
    let actualTestFn: TestFn;

    if (typeof setupOptionsOrTestFn === "function") {
      setupOptions = {
        wolves: ["wolf-player"],
        sheep: ["sheep-player"],
        gold: 10,
      };
      actualTestFn = setupOptionsOrTestFn;
    } else {
      setupOptions = setupOptionsOrTestFn;
      actualTestFn = testFn!;
    }

    itFn(name, () => {
      using testSetup = createTestSetup(setupOptions);

      const generator = testSetup.ecs.batch(() => actualTestFn(testSetup));
      if (!generator) return;

      // Execute the first part of the generator inside ecs.batch
      let result = testSetup.ecs.batch(() => generator.next());

      while (!result.done) {
        // Run ECS update to process systems (like death/bounty)
        testSetup.tick();

        // Execute the next part of the generator inside ecs.batch
        result = testSetup.ecs.batch(() => generator.next());
      }
    });
  }

  return itImpl;
}

export const it = Object.assign(createItImpl(baseIt), {
  only: createItImpl(baseIt.only),
});
