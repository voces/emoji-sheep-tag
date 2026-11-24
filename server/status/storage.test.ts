import { describe, expect, it } from "vitest";
import { openStatusStore, type RoundRecord } from "./storage.ts";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const NOW = Date.UTC(2026, 10, 23, 12);

const round = (endedAt: number, lobby = "lobby"): RoundRecord => ({
  lobby,
  mode: "survival",
  sheep: ["a"],
  wolves: ["b"],
  durationMs: 1000,
  endedAt,
});

describe("page loads", () => {
  it("counts loads into the windows they fall in", () => {
    const store = openStatusStore(":memory:");
    store.incrementPageLoads(NOW - 30 * DAY + MINUTE);
    store.incrementPageLoads(NOW - 2 * DAY);
    store.incrementPageLoads(NOW - 30 * MINUTE);
    store.incrementPageLoads(NOW - MINUTE);
    store.incrementPageLoads(NOW);

    expect(store.getPageLoadStats(NOW)).toEqual({
      total: 5,
      windows: { "5m": 2, "1h": 3, "1d": 3, "7d": 4, "30d": 5 },
    });
  });

  it("keeps the total after old buckets expire", () => {
    const store = openStatusStore(":memory:");
    store.incrementPageLoads(NOW - 40 * DAY);
    store.incrementPageLoads(NOW);

    expect(store.getPageLoadStats(NOW)).toEqual({
      total: 2,
      windows: { "5m": 1, "1h": 1, "1d": 1, "7d": 1, "30d": 1 },
    });
  });
});

describe("push subscriptions", () => {
  it("replaces a subscription with the same endpoint and removes it", () => {
    const store = openStatusStore(":memory:");
    const sub = (auth: string) => ({
      endpoint: "https://push.example/1",
      keys: { p256dh: "p", auth },
      createdAt: NOW,
    });
    store.addSubscription(sub("old"));
    store.addSubscription(sub("new"));
    expect(store.listSubscriptions()).toEqual([sub("new")]);

    store.removeSubscription("https://push.example/1");
    expect(store.listSubscriptions()).toEqual([]);
  });
});

describe("rounds", () => {
  it("lists the most recent rounds first, up to the limit", () => {
    const store = openStatusStore(":memory:");
    store.addRoundRecord(round(NOW - 3 * MINUTE, "c"), NOW);
    store.addRoundRecord(round(NOW - MINUTE, "a"), NOW);
    store.addRoundRecord(round(NOW - 2 * MINUTE, "b"), NOW);

    expect(store.recentRounds(2, NOW).map((r) => r.lobby)).toEqual(["a", "b"]);
  });

  it("drops rounds older than 30 days", () => {
    const store = openStatusStore(":memory:");
    store.addRoundRecord(round(NOW - 31 * DAY, "old"), NOW - 31 * DAY);
    store.addRoundRecord(round(NOW, "new"), NOW);

    expect(store.recentRounds(20, NOW).map((r) => r.lobby)).toEqual(["new"]);
  });
});
