import { styled } from "styled-components";
import { Chat } from "./Chat.tsx";
import { Gold } from "./Gold.tsx";
import { GameStatusPanel } from "./GameStatusPanel.tsx";
import { HStack } from "@/components/layout/Layout.tsx";
import { Editor } from "./Editor/index.tsx";
import { SimpleStats } from "./SimpleStats.tsx";
import { BottomBar } from "./BottomBar/index.tsx";
import { EntityTooltip } from "./EntityTooltip.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorHideUIVar, editorVar } from "@/vars/editor.ts";
import { Feedback } from "./Feedback.tsx";

const TopRight = styled(HStack)`
  position: fixed;
  top: ${({ theme }) => theme.spacing.md};
  right: ${({ theme }) => theme.spacing.md};
  pointer-events: none;
  align-items: start;
`;

export const Game = () => {
  const isEditor = useReactiveVar(editorVar);
  const hideUI = useReactiveVar(editorHideUIVar);

  if (isEditor && hideUI) return null;

  return (
    <>
      <Chat />

      <SimpleStats />

      <TopRight>
        <Gold />
        <GameStatusPanel />
        <Editor />
      </TopRight>

      <Feedback />

      <BottomBar />

      <EntityTooltip />
    </>
  );
};
