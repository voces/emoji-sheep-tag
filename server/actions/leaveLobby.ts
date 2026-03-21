import { z } from "zod";
import { leave } from "../lobbyApi.ts";

export const zLeaveLobby = z.object({ type: z.literal("leaveLobby") });

export const leaveLobby = () => leave();
