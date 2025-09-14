import z from "zod";

export const zTeam = z.union([
  z.literal("sheep"),
  z.literal("wolf"),
  z.literal("wisp"),
  z.literal("observer"),
  z.literal("pending"),
]);
export type Team = z.TypeOf<typeof zTeam>;

export const zPoint = z.object({ x: z.number(), y: z.number() });
