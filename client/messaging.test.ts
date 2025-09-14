import "@/client-testing/integration-setup.ts";
import { setCurrentTestFile } from "@/client-testing/integration-setup.ts";

// Set the current test file name for deterministic port assignment
setCurrentTestFile("messaging.test.ts");
import { beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { waitFor } from "@testing-library/react";
import { send } from "./messaging.ts";
import { connect, setServer } from "./connection.ts";
import {
  clearTestServerMessages,
  getTestServerMessages,
  getTestServerPort,
} from "@/client-testing/integration-setup.ts";
import type { ClientToServerMessage } from "../server/client.ts";
import { connectionStatusVar } from "./ui/vars/state.ts";

describe("messaging.ts", () => {
  beforeEach(async () => {
    clearTestServerMessages();
    setServer(`localhost:${getTestServerPort()}`);
    connect();

    // Wait for connection to establish
    await waitFor(() => {
      if (connectionStatusVar() !== "connected") {
        throw new Error(`Not connected yet, status: ${connectionStatusVar()}`);
      }
    }, { timeout: 3000, interval: 10 });
  });

  describe("send function with WebSocket", () => {
    it("should send messages to test server", async () => {
      const message: ClientToServerMessage = {
        type: "ping",
        data: 123,
      };

      send(message);

      // Wait for message to arrive at server
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual(message);
      }, { interval: 10 });
    });

    it("should handle complex message types", async () => {
      const complexMessage: ClientToServerMessage = {
        type: "generic",
        event: { type: "nameChange", name: "TestPlayer" },
      };

      send(complexMessage);

      // Wait for message to arrive at server
      await waitFor(() => {
        const messages = getTestServerMessages();
        if (messages.length === 0) {
          throw new Error("Message not received yet");
        }
        expect(messages[0]).toEqual(complexMessage);
      }, { interval: 10 });
    });
  });

  describe("error handling", () => {
    it("should handle send when WebSocket is not connected", () => {
      setServer("localhost:9999"); // Invalid server

      expect(() => {
        send({ type: "ping", data: 789 });
      }).not.toThrow();
    });
  });
});
