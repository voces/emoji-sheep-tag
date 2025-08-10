//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { styled } from "npm:styled-components";
import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { send } from "../../../client.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { chatLogVar, chatValueVar } from "@/vars/chat.ts";

export const showChatBoxVar = makeVar<"closed" | "open" | "sent" | "dismissed">(
  "closed",
);

const ChatContainer = styled.div`
  position: absolute;
  bottom: 130px;
  left: 20px;
  pointer-events: none;
`;

const ChatMessage = styled.div`
  opacity: 1;
  animation: fadeOut 3s ease forwards;
  animation-delay: 7s;

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
`;

const ChatInput = styled.input<{ $state: string }>`
  background: transparent;
  color: inherit;
  text-shadow: 0 0 2px ${({ theme }) => theme.colors.border};
  opacity: 0;
  transition: all 100ms ease-in-out;
  outline: none;
  padding-left: ${({ theme }) => theme.spacing.sm};
  margin-left: -${({ theme }) => theme.spacing.sm};
  border: 0;

  ${({ $state, theme }) =>
    $state === "open" && `
    &:focus:not([disabled]) {
      opacity: 1;
      background-color: color-mix(
        in oklab,
        ${theme.colors.background} 70%,
        transparent
      );
      box-shadow: color-mix(in oklab, ${theme.colors.shadow} 70%, transparent)
        1px 1px 4px 1px;
    }
    opacity: 1;
    background-color: color-mix(
      in oklab,
      ${theme.colors.background} 70%,
      transparent
    );
    box-shadow: color-mix(in oklab, ${theme.colors.shadow} 70%, transparent)
      1px 1px 4px 1px;
  `} ${({ $state, theme }) =>
    $state === "dismissed" && `
    opacity: 0.5;
    background-color: color-mix(
      in oklab,
      ${theme.colors.background} 20%,
      transparent
    );
    box-shadow: color-mix(in oklab, ${theme.colors.shadow} 20%, transparent)
      1px 1px 4px 1px;
  `};
`;

export const Chat = () => {
  const chatLog = useReactiveVar(chatLogVar);
  const showChatBox = useReactiveVar(showChatBoxVar);
  const chatValue = useReactiveVar(chatValueVar);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showChatBox === "open") inputRef.current?.focus();
    else inputRef.current?.blur();

    if (showChatBox === "sent") {
      if (inputRef.current?.value) {
        send({ type: "chat", message: inputRef.current.value });
        chatValueVar("");
      }
      showChatBoxVar("closed");
    }

    if (showChatBox === "dismissed" && inputRef.current?.value === "") {
      showChatBoxVar("closed");
    }
  }, [showChatBox]);

  const now = Date.now();

  return (
    <ChatContainer>
      {chatLog.filter((log) => now - log.timestamp < 10_000).map((log) => (
        <ChatMessage key={log.id}>
          <ColorMarkdown text={log.message} />
        </ChatMessage>
      ))}
      <ChatInput
        autoFocus
        $state={showChatBox}
        ref={inputRef}
        maxLength={150}
        value={chatValue}
        onInput={(e) => chatValueVar(e.currentTarget.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.code !== "Enter") return;
          showChatBoxVar("sent");
        }}
        onBlur={() => showChatBoxVar("dismissed")}
      />
    </ChatContainer>
  );
};
