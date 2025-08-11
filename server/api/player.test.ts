import { afterEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  deductPlayerGold,
  getPlayer,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { cleanupTest, createTestSetup } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("player API", () => {
  describe("getPlayer", () => {
    it("should find player in wolves", () => {
      const { clients } = createTestSetup({
        wolves: ["wolf-player"],
      });

      const result = getPlayer("wolf-player");
      expect(result).toBe(clients.get("wolf-player")!.playerEntity);
    });

    it("should find player in sheep", () => {
      const { clients } = createTestSetup({
        sheep: ["sheep-player"],
      });

      const result = getPlayer("sheep-player");
      expect(result).toBe(clients.get("sheep-player")!.playerEntity);
    });

    it("should return undefined for unknown player", () => {
      createTestSetup();

      const result = getPlayer("unknown-player");
      expect(result).toBeUndefined();
    });
  });

  describe("grantPlayerGold", () => {
    it("should grant gold to player with existing gold", () => {
      createTestSetup({
        wolves: ["test-player"],
        gold: 50,
      });

      grantPlayerGold("test-player", 5);

      expect(getPlayerGold("test-player")).toBe(55);
    });

    it("should grant gold to player with no existing gold", () => {
      createTestSetup({
        wolves: ["test-player"],
        gold: 0,
      });

      grantPlayerGold("test-player", 10);

      expect(getPlayerGold("test-player")).toBe(10);
    });

    it("should not grant negative or zero gold", () => {
      createTestSetup({
        wolves: ["test-player"],
        gold: 50,
      });

      grantPlayerGold("test-player", 0);
      grantPlayerGold("test-player", -5);

      expect(getPlayerGold("test-player")).toBe(50);
    });

    it("should handle unknown player gracefully", () => {
      createTestSetup();

      grantPlayerGold("unknown-player", 10);

      expect(getPlayerGold("unknown-player")).toBe(0);
    });
  });

  describe("deductPlayerGold", () => {
    it("should deduct gold from player", () => {
      createTestSetup({
        wolves: ["test-player"],
        gold: 50,
      });

      deductPlayerGold("test-player", 15);

      expect(getPlayerGold("test-player")).toBe(35);
    });
  });
});
