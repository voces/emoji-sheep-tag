import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { hashIp } from "./hashIp.ts";

describe("hashIp", () => {
  it("is deterministic so a player's client id is stable across sessions", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
  });

  it("differs between distinct IPs", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });

  it("does not expose the raw IP", () => {
    expect(hashIp("203.0.113.7")).not.toContain("203.0.113.7");
  });
});
