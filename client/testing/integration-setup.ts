import "./setup.ts";
import { afterEach, beforeEach, expect } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import type { ClientToServerMessage } from "../../server/client.ts";
import { ServerToClientMessage } from "../schemas.ts";
import type { WebSocket } from "ws";
import { startWsServer, type TestWsServer } from "@/server-testing/wsServer.ts";

// Fresh test WebSocket server per test, on its own ephemeral port
let testServer: TestWsServer | undefined;
const testServerMessages: ClientToServerMessage[] = [];
const activeWebSockets: Set<WebSocket> = new Set();

const startTestServer = async () => {
  if (testServer) await stopTestServer();
  testServer = await startWsServer({
    onConnection: (socket) => {
      activeWebSockets.add(socket);
      socket.addEventListener("message", (event) => {
        try {
          testServerMessages.push(JSON.parse(String(event.data)));
        } catch (err) {
          console.error("Failed to parse test message:", err);
        }
      });
      socket.addEventListener("close", () => activeWebSockets.delete(socket));
      socket.addEventListener("error", () => activeWebSockets.delete(socket));
    },
  });
};

const stopTestServer = async () => {
  activeWebSockets.clear();
  await testServer?.close();
  testServer = undefined;
};

export const sendMessageFromServer = async (message: ServerToClientMessage) => {
  const stringify = JSON.stringify(message);
  await waitFor(() => expect(activeWebSockets.size).toBeGreaterThan(0));
  for (const socket of activeWebSockets) socket.send(stringify);
};

beforeEach(async () => {
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
    const { stopPing } = await import("../ping.ts");
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

export const getTestServerMessages = () => [...testServerMessages];
export const clearTestServerMessages = () => testServerMessages.length = 0;
export const getTestServerPort = () => {
  if (!testServer) throw new Error("The test server starts in beforeEach");
  return testServer.port;
};
