import { z } from "npm:zod";
import { Client } from "../client.ts";

export const zPing = z.object({
  type: z.literal("ping"),
  data: z.unknown(),
});

export const ping = (client: Client, { data }: z.TypeOf<typeof zPing>) => {
  client.send({ type: "pong", time: performance.now(), data });
};
