import "@/testing/setup.ts";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { send } from "./messaging.ts";
import { connect, setServer } from "./connection.ts";
import {
  clearTestServerMessages,
  getTestServerMessages,
} from "@/testing/setup.ts";
import type { ClientToServerMessage } from "../server/client.ts";

describe("messaging.ts", () => {
  beforeEach(async () => {
    clearTestServerMessages();
    setServer("localhost:8888");
    connect();

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe("send function with WebSocket", () => {
    it("should send messages to test server", async () => {
      const message: ClientToServerMessage = {
        type: "ping",
        data: 123,
      };

      send(message);

      // Wait for message to arrive at server
      await new Promise((resolve) => setTimeout(resolve, 50));

      const messages = getTestServerMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it("should handle complex message types", async () => {
      const complexMessage: ClientToServerMessage = {
        type: "generic",
        event: { type: "nameChange", name: "TestPlayer" },
      };

      send(complexMessage);

      // Wait for message to arrive at server
      await new Promise((resolve) => setTimeout(resolve, 50));

      const messages = getTestServerMessages();
      expect(messages[0]).toEqual(complexMessage);
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
