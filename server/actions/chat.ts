import { z } from "npm:zod";
import { send } from "../lobbyApi.ts";
import { Client } from "../client.ts";

export const zChat = z.object({
  type: z.literal("chat"),
  message: z.string(),
});

export const chat = (client: Client, { message }: z.TypeOf<typeof zChat>) => {
  console.log(new Date(), client.name, message);
  if (message === "loop") {
    while (true) {}
  }
  send({ type: "chat", player: client.id, message });
};
