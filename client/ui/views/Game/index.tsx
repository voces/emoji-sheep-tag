import { Chat } from "./Chat.tsx";
import { ActionBar } from "./ActionBar.tsx";
import { Gold } from "./Gold.tsx";
import { Avatars } from "./Avatars.tsx";

export const Game = () => (
  <>
    <Avatars />
    <Gold />
    <Chat />
    <ActionBar />
  </>
);
