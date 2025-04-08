import { Chat } from "./Chat.tsx";
import { CommandPalette } from "./CommandPalette.tsx";
import { ActionBar } from "./ActionBar.tsx";

export const Game = () => (
  <>
    <CommandPalette />
    <Chat />
    <ActionBar />
  </>
);
