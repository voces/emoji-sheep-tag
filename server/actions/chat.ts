import { z } from "zod";
import { send } from "../lobbyApi.ts";
import { Client } from "../client.ts";
import { lobbyContext } from "../contexts.ts";

export const zChatChannel = z.enum(["all", "allies"]);
export type ChatChannel = z.infer<typeof zChatChannel>;

export const zChat = z.object({
  type: z.literal("chat"),
  message: z.string(),
  channel: zChatChannel.optional(),
});

export const chat = (
  client: Client,
  { message, channel = "all" }: z.TypeOf<typeof zChat>,
) => {
  const channelLabel = channel === "allies" ? "[Allies]" : "[All]";
  console.log(new Date(), channelLabel, `${client.name}:`, message);

  if (channel === "allies") {
    const lobby = lobbyContext.current;
    const serialized = JSON.stringify({
      type: "chat",
      player: client.id,
      message,
      channel,
    });
    for (const p of lobby.players) {
      if (p.team === client.team) p.rawSend(serialized);
    }
  } else {
    send({ type: "chat", player: client.id, message, channel });
  }
};
