//@deno-types="npm:@types/react"
import { useCallback, useLayoutEffect, useRef } from "react";
import { styled } from "npm:styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { chatLogVar, chatValueVar } from "@/vars/chat.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { send } from "../../../client.ts";
import { Card } from "@/components/layout/Card.tsx";
import { Input } from "@/components/forms/Input.tsx";

const ChatCard = styled(Card)`
  height: 200px;
  padding-top: 0;
  max-height: calc(100vh - 300px);
  min-height: 85px;
  display: flex;
  flex-direction: column;
`;

const ChatMessagesContainer = styled.div`
  overflow: auto;
  margin-top: auto;
  margin-right: -16px;
  padding-right: 16px;
`;

const ChatInput = styled(Input)`
  max-width: none;
`;

export const Chat = () => {
  const chatLog = useReactiveVar(chatLogVar);
  const chatValue = useReactiveVar(chatValueVar);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = chatLogRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 20;
  }, []);

  useLayoutEffect(() => {
    const el = chatLogRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [chatLog]);

  return (
    <ChatCard>
      <ChatMessagesContainer
        ref={chatLogRef}
        onScroll={handleScroll}
      >
        {chatLog.map((log) => (
          <div key={log.id}>
            <ColorMarkdown text={log.message} />
          </div>
        ))}
      </ChatMessagesContainer>
      <ChatInput
        autoFocus
        maxLength={150}
        value={chatValue}
        onInput={(e) => chatValueVar(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (!e.code.includes("Enter") || !e.currentTarget.value) return;
          send({ type: "chat", message: e.currentTarget.value });
          chatValueVar("");
        }}
      />
    </ChatCard>
  );
};