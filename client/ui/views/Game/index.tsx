import { styled } from "npm:styled-components";
import { Chat } from "./Chat.tsx";
import { ActionBar } from "./ActionBar.tsx";
import { Gold } from "./Gold.tsx";
import { Avatars } from "./Avatars.tsx";
import { Timers } from "./Timers.tsx";
import { HStack } from "@/components/layout/Layout.tsx";

const TopRight = styled(HStack)`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  pointer-events: none;
`;

export const Game = () => (
  <>
    <Avatars />
    <TopRight>
      <Gold />
      <Timers />
    </TopRight>
    <Chat />
    <ActionBar />
  </>
);
