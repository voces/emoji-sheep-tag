import "./setup.ts";
import { afterEach, beforeEach } from "@std/testing/bdd";
import { cleanup, waitFor } from "@testing-library/react";
import type { ClientToServerMessage } from "../../server/client.ts";
import { ServerToClientMessage } from "../client.ts";
import { expect } from "@std/expect/expect";

// Test WebSocket server for messaging tests - fresh server per test for true isolation
let testServer: Deno.HttpServer | undefined;
const testServerMessages: ClientToServerMessage[] = [];
const activeWebSockets: Set<WebSocket> = new Set();

// Port registry system for deterministic, unique port assignments
type PortRegistry = {
  [testFileName: string]: number;
};

const PORT_REGISTRY_PATH =
  new URL("./test-port-registry.json", import.meta.url).pathname;
const MIN_PORT = 9000;
const MAX_PORT = 9999;

// Load or create port registry
const loadPortRegistry = async (): Promise<PortRegistry> => {
  try {
    const content = await Deno.readTextFile(PORT_REGISTRY_PATH);
    return JSON.parse(content);
  } catch {
    // File doesn't exist, return empty registry
    return {};
  }
};

// Save port registry to disk
const savePortRegistry = async (registry: PortRegistry): Promise<void> => {
  await Deno.writeTextFile(
    PORT_REGISTRY_PATH,
    JSON.stringify(registry, null, 2),
  );
};

// Store the test file name per process (set externally or derived)
let currentTestFileName: string | undefined;

// Set test file name (can be called by test files explicitly)
export const setCurrentTestFile = (fileName: string): void => {
  currentTestFileName = fileName;
};

// Get test file name using multiple detection strategies
const getTestFileName = (): string => {
  // If explicitly set, use that
  if (currentTestFileName) {
    return currentTestFileName;
  }

  // Try to extract from Deno args (most reliable for file-level execution)
  if (globalThis.Deno && Deno.args) {
    for (const arg of Deno.args) {
      if (arg.includes(".test.ts")) {
        const match = arg.match(/([^\/\\]+\.test\.ts)/);
        if (match) {
          currentTestFileName = match[1];
          return match[1];
        }
      }
    }
  }

  // Try stack trace analysis
  const stack = new Error().stack || "";
  const lines = stack.split("\n");

  for (const line of lines) {
    if (line.includes(".test.ts") && !line.includes("integration-setup.ts")) {
      const match = line.match(/([^\/\\\s]+\.test\.ts)/);
      if (match) {
        currentTestFileName = match[1];
        return match[1];
      }
    }
  }

  // Generate a unique but stable identifier for this test session
  const processId = Deno.pid || Math.floor(Math.random() * 100000);
  const fallback = `test-session-${processId}`;
  currentTestFileName = fallback;
  return fallback;
};

// Get or assign port for current test file
const getPortForTestFile = async (): Promise<number> => {
  const testFileName = getTestFileName();
  const registry = await loadPortRegistry();

  // Return existing port if already assigned
  if (registry[testFileName]) {
    return registry[testFileName];
  }

  // Find next available port number
  const usedPorts = new Set(Object.values(registry));
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      // Assign this port to the test file
      registry[testFileName] = port;
      await savePortRegistry(registry);
      return port;
    }
  }

  throw new Error(
    `No available ports in range ${MIN_PORT}-${MAX_PORT}. Registry has ${
      Object.keys(registry).length
    } entries.`,
  );
};

// Initialize port for current test file
let TEST_PORT: number = 9000; // Default fallback
let portInitialized = false;

const initializePort = async (): Promise<void> => {
  if (!portInitialized) {
    TEST_PORT = await getPortForTestFile();
    portInitialized = true;
  }
};

// Assert that port gets properly initialized
const assertPortInitialized = (): void => {
  if (
    !portInitialized || !TEST_PORT || TEST_PORT < MIN_PORT ||
    TEST_PORT > MAX_PORT
  ) {
    throw new Error(
      `Test port not properly initialized: ${TEST_PORT}. Call initializePort() first.`,
    );
  }
};

// Utility to check if port is in use by attempting to connect
const isPortInUse = async (port: number): Promise<boolean> => {
  try {
    const conn = await Deno.connect({ hostname: "localhost", port });
    conn.close();
    return true; // Port is in use if we can connect
  } catch {
    return false; // Port is available if connection fails
  }
};

// Wait for port to become available
const waitForPortAvailable = async (
  port: number,
  timeoutMs = 5000,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isPortInUse(port))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `Port ${port} did not become available within ${timeoutMs}ms`,
  );
};

// Start fresh test server for each test
const startTestServer = async () => {
  // Ensure any existing server is stopped first
  if (testServer) {
    await stopTestServer();
  }

  // Create a promise that resolves when server is ready
  let serverReady: () => void;
  const serverReadyPromise = new Promise<void>((resolve) => {
    serverReady = resolve;
  });

  testServer = Deno.serve({
    port: TEST_PORT,
    onListen: () => {
      serverReady(); // Signal that server is ready
    },
  }, (req) => {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response(null, { status: 501 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    // Track active WebSocket connections
    activeWebSockets.add(socket);

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        testServerMessages.push(message);
      } catch (err) {
        console.error("Failed to parse test message:", err);
      }
    });

    socket.addEventListener("close", () => {
      activeWebSockets.delete(socket);
    });

    socket.addEventListener("error", () => {
      activeWebSockets.delete(socket);
    });

    return response;
  });

  // Wait for server to actually be ready
  await serverReadyPromise;
};

// Stop test server and clean up all connections
const stopTestServer = async () => {
  // Close all active WebSocket connections first
  for (const socket of activeWebSockets) {
    try {
      if (socket.readyState !== 3) { // 3 = CLOSED
        socket.close();
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
  activeWebSockets.clear();

  // Shutdown the server
  if (testServer) {
    await testServer.shutdown();
    testServer = undefined;
    // Wait for port to be available again
    await waitForPortAvailable(TEST_PORT);
  }
};

export const sendMessageFromServer = async (message: ServerToClientMessage) => {
  const stringify = JSON.stringify(message);
  await waitFor(() => expect(activeWebSockets.size).toBeGreaterThan(0));
  for (const socket of activeWebSockets) socket.send(stringify);
};

beforeEach(async () => {
  // Initialize unique port for this test run
  await initializePort();

  // Clear test server messages
  testServerMessages.length = 0;

  // Reset connection state to ensure clean start
  try {
    const { resetConnection } = await import("../connection.ts");
    resetConnection();
  } catch {
    // Ignore import errors during cleanup
  }

  // Start fresh server for this test
  await startTestServer();
});

afterEach(async () => {
  // Stop ping timer to prevent timer leaks
  try {
    const { stopPing } = await import("../messaging.ts");
    stopPing();
  } catch {
    // Ignore import errors during cleanup
  }

  // Close client WebSocket connections
  try {
    const { resetConnection } = await import("../connection.ts");
    resetConnection();
  } catch {
    // Ignore import errors during cleanup
  }

  // Clean up local/offline mode resources
  try {
    const localModule = await import("../local.ts");
    if ("__testing_cleanup_local" in localModule) {
      (localModule as { __testing_cleanup_local: () => void })
        .__testing_cleanup_local();
    }
  } catch {
    // Ignore import errors during cleanup
  }

  // React Testing Library cleanup (for UI tests)
  cleanup();

  // Stop the test server and clean up all connections
  await stopTestServer();
});

// Cleanup on process exit (fallback)
globalThis.addEventListener("unload", () => {
  stopTestServer();
});

// Export utilities for WebSocket messaging tests
export const getTestServerMessages = () => [...testServerMessages];
export const clearTestServerMessages = () => testServerMessages.length = 0;
export const getTestServerUrl = () => {
  assertPortInitialized();
  return `ws://localhost:${TEST_PORT}`;
};
export const getTestServerPort = () => {
  assertPortInitialized();
  return TEST_PORT;
};
// Legacy exports for backward compatibility
export const TEST_SERVER_URL = `ws://localhost:${TEST_PORT}`;
export const TEST_SERVER_PORT = TEST_PORT;
