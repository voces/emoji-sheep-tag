import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import { distributeEquitably } from "./equitableDistribution.ts";

describe("distributeEquitably", () => {
  describe("equalization - bringing everyone to same level", () => {
    it("should equalize three recipients with different gold", () => {
      // Total: 100 + 90 = 190, target: 63.33 each
      const result = distributeEquitably(90, [50, 30, 20]);
      expect(result[0]).toBeCloseTo(13.333, 2);
      expect(result[1]).toBeCloseTo(33.333, 2);
      expect(result[2]).toBeCloseTo(43.333, 2);
      // Final amounts: ~[63.33, 63.33, 63.33]
    });

    it("should equalize two recipients", () => {
      // Total: 300 + 99 = 399, target: 199.5 each
      const result = distributeEquitably(99, [200, 100]);
      expect(result).toEqual([0, 99]);
      // Final amounts: [200, 199] - nearly equal
    });

    it("should prioritize poorest when not enough to fully equalize", () => {
      // Total: 120 + 120 = 240, target would be 80 each
      // But we can only lift the two poor ones
      const result = distributeEquitably(120, [100, 10, 10]);
      expect(result).toEqual([0, 60, 60]);
      // Final amounts: [100, 70, 70]
    });

    it("should handle four recipients", () => {
      // Total: 100 + 200 = 300, target: 75 each
      const result = distributeEquitably(200, [40, 30, 20, 10]);
      expect(result).toEqual([35, 45, 55, 65]);
      // Final amounts: [75, 75, 75, 75]
    });
  });

  describe("equal distribution (when all have same gold)", () => {
    it("should distribute equally when all have same gold", () => {
      const result = distributeEquitably(100, [50, 50]);
      expect(result).toEqual([50, 50]);
      // Final amounts: [100, 100]
    });

    it("should distribute equally when all have 0 gold", () => {
      const result = distributeEquitably(100, [0, 0]);
      expect(result).toEqual([50, 50]);
    });

    it("should distribute equally among multiple recipients with same gold", () => {
      const result = distributeEquitably(120, [25, 25, 25, 25]);
      expect(result).toEqual([30, 30, 30, 30]);
    });

    it("should handle remainder distribution", () => {
      // 100 doesn't divide evenly by 3
      const result = distributeEquitably(100, [10, 10, 10]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
      // Should be close to [33, 33, 34] or similar
      expect(result.every((r) => r >= 33 && r <= 34)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty array", () => {
      const result = distributeEquitably(100, []);
      expect(result).toEqual([]);
    });

    it("should handle zero total amount", () => {
      const result = distributeEquitably(0, [50, 100]);
      expect(result).toEqual([0, 0]);
    });

    it("should handle single recipient", () => {
      const result = distributeEquitably(100, [50]);
      expect(result).toEqual([100]);
    });

    it("should handle single recipient with 0 gold", () => {
      const result = distributeEquitably(100, [0]);
      expect(result).toEqual([100]);
    });
  });

  describe("game scenarios", () => {
    it("should help struggling players catch up", () => {
      // Dying sheep has 100 gold
      // Survivor A has 200 gold (rich), Survivor B has 100 gold (medium)
      // B should get all of it to catch up to A
      const result = distributeEquitably(99, [200, 100]);
      expect(result).toEqual([0, 99]);
      // Final: [200, 199] - nearly equal
    });

    it("should distribute at game start (all 0 gold) equally", () => {
      const result = distributeEquitably(150, [0, 0, 0]);
      expect(result).toEqual([50, 50, 50]);
    });

    it("should help the poorest most when big wealth gap", () => {
      // One rich (500), one struggling (50)
      const result = distributeEquitably(400, [500, 50]);
      expect(result).toEqual([0, 400]);
      // Final: [500, 450] - much closer
    });

    it("should handle realistic death scenario", () => {
      // Three sheep: 150, 100, 50 gold
      // One dies with 80 gold
      const result = distributeEquitably(80, [150, 100, 50]);
      // Brings poorest (50) up to 100, costing 50
      // Then brings both to 115, costing remaining 30
      expect(result).toEqual([0, 15, 65]);
      // Final: [150, 115, 115] - two at same level, one ahead
    });
  });

  describe("mathematical properties", () => {
    it("should never exceed total amount", () => {
      const result = distributeEquitably(100, [33, 66, 99]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 10);
    });

    it("should always sum to exactly the distributed amount", () => {
      const testCases = [
        { amount: 99, gold: [200, 100] },
        { amount: 90, gold: [50, 30, 20] },
        { amount: 120, gold: [100, 10, 10] },
        { amount: 1000, gold: [500, 300, 200, 100, 50] },
      ];

      for (const { amount, gold } of testCases) {
        const result = distributeEquitably(amount, gold);
        const sum = result.reduce((a, b) => a + b, 0);
        expect(sum).toBe(amount);
      }
    });

    it("should reduce inequality (std deviation decreases)", () => {
      const before = [100, 50, 20];
      const distributed = distributeEquitably(90, before);
      const after = before.map((g, i) => g + distributed[i]);

      const stdBefore = Math.sqrt(
        before.reduce((sum, g) => {
          const mean = before.reduce((a, b) => a + b) / before.length;
          return sum + (g - mean) ** 2;
        }, 0) / before.length,
      );

      const stdAfter = Math.sqrt(
        after.reduce((sum, g) => {
          const mean = after.reduce((a, b) => a + b) / after.length;
          return sum + (g - mean) ** 2;
        }, 0) / after.length,
      );

      expect(stdAfter).toBeLessThan(stdBefore);
    });
  });
});
