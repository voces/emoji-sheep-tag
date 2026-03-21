import { z } from "zod";
import { type Client, getAllClients } from "../client.ts";
import { generateUniqueName } from "../util/uniqueName.ts";

export const zChangeName = z.object({
  type: z.literal("changeName"),
  name: z.string().min(1).max(16),
});

export const changeName = (
  client: Client,
  { name }: z.TypeOf<typeof zChangeName>,
) => {
  const uniqueName = generateUniqueName(name, getAllClients(), client);
  client.name = uniqueName;
  client.send({ type: "nameChanged", name: uniqueName });
};
