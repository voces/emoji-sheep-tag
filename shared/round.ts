import { z } from "zod";

export const zMode = z.union([
  z.literal("survival"),
  z.literal("vip"),
  z.literal("switch"),
  z.literal("vamp"),
  z.literal("bulldog"),
]);
export type Mode = z.infer<typeof zMode>;

/** A goal: a sheep player reached the End in bulldog. */
export const zGoalEvent = z.object({
  type: z.literal("goal"),
  player: z.string(),
  /** Milliseconds since round start. */
  time: z.number(),
});

/** Discriminated union of round-event types. */
export const zRoundEvent = z.discriminatedUnion("type", [zGoalEvent]);
export type RoundEvent = z.infer<typeof zRoundEvent>;

/** Wolves-to-sheep imbalance, raised to a curve so larger lobbies scale a bit harder. */
const bulldogRatio = (sheep: number, wolves: number) =>
  (Math.max(wolves, 1) / Math.max(sheep, 1)) ** 1.25;

/**
 * Mode-tuned default starting gold. Bulldog scales with the wolf:sheep ratio
 * so the shorter rounds still let sheep make meaningful purchases on the way
 * to End. All other modes start at zero.
 */
export const getDefaultStartingGold = (
  mode: Mode,
  sheep: number,
  wolves: number,
): { sheep: number; wolves: number } => {
  if (mode !== "bulldog") return { sheep: 0, wolves: 0 };
  return { sheep: Math.round(50 * bulldogRatio(sheep, wolves)), wolves: 0 };
};

/** Mode-tuned default per-second income. Bulldog runs hotter on both sides. */
export const getDefaultIncome = (
  mode: Mode,
  sheep: number,
  wolves: number,
): { sheep: number; wolves: number } => {
  if (mode !== "bulldog") return { sheep: 1, wolves: 1 };
  return {
    sheep: Math.round(20 * bulldogRatio(sheep, wolves)) / 10,
    wolves: 2,
  };
};

/** A completed round, used both for survival "average time" and bulldog stats. */
export const zRound = z.object({
  sheep: z.array(z.string()),
  wolves: z.array(z.string()),
  duration: z.number(),
  mode: zMode,
  events: z.array(zRoundEvent).optional(),
});
export type Round = z.infer<typeof zRound>;
