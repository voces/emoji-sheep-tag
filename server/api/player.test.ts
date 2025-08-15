import { afterEach, describe } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  deductPlayerGold,
  getPlayer,
  getPlayerGold,
  grantPlayerGold,
} from "./player.ts";
import { cleanupTest, it } from "@/server-testing/setup.ts";

afterEach(cleanupTest);

describe("player API", () => {
  describe("getPlayer", () => {
    it(
      "should find player in wolves",
      { wolves: ["wolf-player"] },
      ({ clients }) => {
        const result = getPlayer("wolf-player");
        expect(result).toBe(clients.get("wolf-player")!.playerEntity);
      },
    );

    it(
      "should find player in sheep",
      { sheep: ["sheep-player"] },
      ({ clients }) => {
        const result = getPlayer("sheep-player");
        expect(result).toBe(clients.get("sheep-player")!.playerEntity);
      },
    );

    it("should return undefined for unknown player", () => {
      const result = getPlayer("unknown-player");
      expect(result).toBeUndefined();
    });
  });

  describe("grantPlayerGold", () => {
    it("should grant gold to player with existing gold", {
      wolves: ["test-player"],
      gold: 50,
    }, function* () {
      grantPlayerGold("test-player", 5);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(55, 0);
    });

    it("should grant gold to player with no existing gold", {
      wolves: ["test-player"],
      gold: 0,
    }, function* () {
      grantPlayerGold("test-player", 10);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(10, 0);
    });

    it("should not grant negative or zero gold", {
      wolves: ["test-player"],
      gold: 50,
    }, function* () {
      grantPlayerGold("test-player", 0);
      grantPlayerGold("test-player", -5);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(50, 0);
    });

    it("should handle unknown player gracefully", function* () {
      grantPlayerGold("unknown-player", 10);
      yield;

      expect(getPlayerGold("unknown-player")).toBe(0);
    });
  });

  describe("deductPlayerGold", () => {
    it("should deduct gold from player", {
      wolves: ["test-player"],
      gold: 50,
    }, function* () {
      deductPlayerGold("test-player", 15);
      yield;

      expect(getPlayerGold("test-player")).toBeCloseTo(35, 0);
    });
  });
});
