import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import { formatDuration } from "./formatDuration.ts";

describe("formatDuration", () => {
  describe("basic seconds formatting", () => {
    it("should format seconds less than 10", () => {
      expect(formatDuration(5000)).toBe("0:05"); // 5 seconds
      expect(formatDuration(9000)).toBe("0:09"); // 9 seconds
      expect(formatDuration(1000)).toBe("0:01"); // 1 second
      expect(formatDuration(0)).toBe("0:00"); // 0 seconds
    });

    it("should format seconds 10 and above", () => {
      expect(formatDuration(10000)).toBe("0:10"); // 10 seconds
      expect(formatDuration(15000)).toBe("0:15"); // 15 seconds
      expect(formatDuration(30000)).toBe("0:30"); // 30 seconds
      expect(formatDuration(59000)).toBe("0:59"); // 59 seconds
    });
  });

  describe("minutes formatting", () => {
    it("should format single digit minutes", () => {
      expect(formatDuration(60000)).toBe("1:00"); // 1 minute
      expect(formatDuration(65000)).toBe("1:05"); // 1:05
      expect(formatDuration(70000)).toBe("1:10"); // 1:10
      expect(formatDuration(120000)).toBe("2:00"); // 2 minutes
      expect(formatDuration(540000)).toBe("9:00"); // 9 minutes
    });

    it("should format double digit minutes", () => {
      expect(formatDuration(600000)).toBe("10:00"); // 10 minutes
      expect(formatDuration(610000)).toBe("10:10"); // 10:10 - potential bug case!
      expect(formatDuration(665000)).toBe("11:05"); // 11:05
      expect(formatDuration(1200000)).toBe("20:00"); // 20 minutes
      expect(formatDuration(3540000)).toBe("59:00"); // 59 minutes
    });
  });

  describe("hours formatting", () => {
    it("should format single digit hours", () => {
      expect(formatDuration(3600000)).toBe("1:00:00"); // 1 hour
      expect(formatDuration(3665000)).toBe("1:01:05"); // 1:01:05
      expect(formatDuration(3670000)).toBe("1:01:10"); // 1:01:10
      expect(formatDuration(7200000)).toBe("2:00:00"); // 2 hours
    });

    it("should format double digit hours", () => {
      expect(formatDuration(36000000)).toBe("10:00:00"); // 10 hours
      expect(formatDuration(36610000)).toBe("10:10:10"); // 10:10:10
    });

    it("should handle edge cases with hours", () => {
      expect(formatDuration(3661000)).toBe("1:01:01"); // 1:01:01
      expect(formatDuration(3719000)).toBe("1:01:59"); // 1:01:59
      expect(formatDuration(7380000)).toBe("2:03:00"); // 2:03:00
    });
  });

  describe("milliseconds formatting", () => {
    it("should include milliseconds when requested", () => {
      expect(formatDuration(5500, true)).toBe("0:05.500");
      expect(formatDuration(10500, true)).toBe("0:10.500");
      expect(formatDuration(65500, true)).toBe("1:05.500");
      expect(formatDuration(610500, true)).toBe("10:10.500");
    });

    it("should pad milliseconds correctly", () => {
      expect(formatDuration(5050, true)).toBe("0:05.050");
      expect(formatDuration(5005, true)).toBe("0:05.005");
      expect(formatDuration(5000, true)).toBe("0:05.000");
    });
  });

  describe("edge cases and potential bugs", () => {
    it("should handle the '8:010' bug case", () => {
      // This should be 8:10, not 8:010
      expect(formatDuration(490000)).toBe("8:10"); // 8 minutes 10 seconds
      expect(formatDuration(610000)).toBe("10:10"); // 10 minutes 10 seconds
    });

    it("should handle fractional seconds correctly", () => {
      expect(formatDuration(10500)).toBe("0:10"); // 10.5 seconds -> 0:10
      expect(formatDuration(10999)).toBe("0:10"); // 10.999 seconds -> 0:10
    });

    it("should handle large numbers", () => {
      expect(formatDuration(359999000)).toBe("99:59:59"); // 99:59:59
    });

    it("should handle very small numbers", () => {
      expect(formatDuration(500)).toBe("0:00"); // 0.5 seconds
      expect(formatDuration(999)).toBe("0:00"); // 0.999 seconds
    });
  });

  describe("boundary cases", () => {
    it("should handle exact minute boundaries", () => {
      expect(formatDuration(59999)).toBe("0:59"); // 59.999 seconds
      expect(formatDuration(599999)).toBe("9:59"); // 9:59.999
      expect(formatDuration(3599999)).toBe("59:59"); // 59:59.999
    });

    it("should handle 10-minute boundary specifically", () => {
      // This is where the bug likely occurs
      expect(formatDuration(600000)).toBe("10:00"); // Exactly 10 minutes
      expect(formatDuration(601000)).toBe("10:01"); // 10:01
      expect(formatDuration(610000)).toBe("10:10"); // 10:10 - the problematic case
    });
  });
});
