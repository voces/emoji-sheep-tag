import "npm:global-jsdom/register";
import { afterEach, beforeEach } from "jsr:@std/testing/bdd";
import { cleanup } from "npm:@testing-library/react";
import { __testing_reset_all_vars } from "../ui/hooks/useVar.tsx";
import { data } from "../data.ts";
import { app, map } from "../ecs.ts";
import type { ClientToServerMessage } from "../../server/client.ts";

// Test WebSocket server for messaging tests - fresh server per test for true isolation
let testServer: Deno.HttpServer | undefined;
const testServerMessages: ClientToServerMessage[] = [];
const activeWebSockets: Set<WebSocket> = new Set();
const TEST_PORT = 8888;

// Start fresh test server for each test
const startTestServer = async () => {
  // Ensure any existing server is stopped first
  if (testServer) {
    await stopTestServer();
  }

  testServer = Deno.serve({
    port: TEST_PORT,
    onListen: () => {}, // Suppress listen messages
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

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 50));
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
  }

  // Wait for cleanup to complete
  await new Promise((resolve) => setTimeout(resolve, 10));
};

beforeEach(async () => {
  // Reset client state (shared by all tests)
  __testing_reset_all_vars();
  data.sheep = [];
  data.wolves = [];
  for (const entity of app.entities) app.removeEntity(entity);
  for (const key in map) delete map[key];

  // Clear test server messages
  testServerMessages.length = 0;

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
export const TEST_SERVER_URL = `ws://localhost:${TEST_PORT}`;
