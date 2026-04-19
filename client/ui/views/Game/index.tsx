import { styled } from "styled-components";
import { Chat } from "./Chat.tsx";
import { Gold } from "./Gold.tsx";
import { GameStatusPanel } from "./GameStatusPanel.tsx";
import { Editor } from "./Editor/index.tsx";
import { SimpleStats } from "./SimpleStats.tsx";
import { HudMenu } from "./HudMenu.tsx";
import { BottomBar } from "./BottomBar/index.tsx";
import { EntityTooltip } from "./EntityTooltip.tsx";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { editorHideUIVar, editorVar } from "@/vars/editor.ts";
import { Feedback } from "./Feedback.tsx";

const TopRight = styled.div`
  position: fixed;
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[4]};
  display: flex;
  align-items: start;
  gap: ${({ theme }) => theme.space[2]};
  pointer-events: none;
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
        {!isEditor && <HudMenu />}
        <Editor />
      </TopRight>

      <Feedback />

      <BottomBar />

      <EntityTooltip />
    </>
  );
};
