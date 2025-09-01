import { Chat } from "./Chat.tsx";
import { ActionBar } from "@/components/game/ActionBar.tsx";
import { Gold } from "@/components/game/Gold.tsx";

export const Game = () => (
  <>
    <Gold />
    <Chat />
    <ActionBar />
  </>
);
