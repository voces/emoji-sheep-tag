import { afterEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { clearPing, getPing, recordPing } from "./pingStore.ts";

describe("per-server ping tracking", () => {
  afterEach(() => {
    clearPing("primary");
    clearPing("shard-game");
    clearPing({ shard: "shard-0" });
    clearPing({ shard: "shard-1" });
  });

  it("records and reads back a ping per key", () => {
    recordPing("primary", 42);
    recordPing("shard-game", 17);
    recordPing({ shard: "shard-0" }, 88);

    expect(getPing("primary")).toBe(42);
    expect(getPing("shard-game")).toBe(17);
    expect(getPing({ shard: "shard-0" })).toBe(88);
  });

  it("isolates keys so recording one does not overwrite another", () => {
    recordPing("primary", 60);
    recordPing({ shard: "shard-0" }, 10);
    recordPing({ shard: "shard-1" }, 200);

    expect(getPing("primary")).toBe(60);
    expect(getPing({ shard: "shard-0" })).toBe(10);
    expect(getPing({ shard: "shard-1" })).toBe(200);

    recordPing("primary", 75);
    expect(getPing("primary")).toBe(75);
    expect(getPing({ shard: "shard-0" })).toBe(10);
    expect(getPing({ shard: "shard-1" })).toBe(200);
  });

  it("returns undefined for stale entries (>5s old)", () => {
    const realNow = performance.now.bind(performance);
    let fake = realNow();
    performance.now = () => fake;
    try {
      recordPing("primary", 30);
      expect(getPing("primary")).toBe(30);

      fake += 4_000;
      expect(getPing("primary")).toBe(30);

      fake += 2_000;
      expect(getPing("primary")).toBeUndefined();
    } finally {
      performance.now = realNow;
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(getPing({ shard: "never-recorded" })).toBeUndefined();
    expect(getPing("primary")).toBeUndefined();
  });
});
