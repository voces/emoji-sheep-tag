import { styled } from "styled-components";
import { Chat } from "./Chat.tsx";
import { Gold } from "./Gold.tsx";
import { Timers } from "./Timers.tsx";
import { HStack } from "@/components/layout/Layout.tsx";
import { Editor } from "./Editor/index.tsx";
import { SimpleStats } from "./SimpleStats.tsx";
import { BottomBar } from "./BottomBar/index.tsx";

const TopRight = styled(HStack)`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  pointer-events: none;
  align-items: start;
`;

export const Game = () => (
  <>
    <Chat />

    {/* <Avatars /> */}

    <SimpleStats />

    <TopRight>
      <Gold />
      <Timers />
      <Editor />
    </TopRight>

    <BottomBar />
  </>
);
