import { useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { send } from "../../../client.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { chatLogVar, chatValueVar } from "@/vars/chat.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";

const ChatContainer = styled.div`
  position: absolute;
  bottom: 130px;
  left: 20px;
  pointer-events: none;
`;

const ChatMessage = styled.div<{
  $showChat: string;
  $messageAge: number;
  $isNew: boolean;
}>`
  ${({ $showChat, $messageAge, $isNew }) => {
    const isOpen = $showChat === "open" || $showChat === "dismissed";
    const ageInSeconds = $messageAge / 1000;

    if ($isNew) {
      // New message - start visible (browser will paint this first)
      return `
        opacity: 1;
      `;
    } else if (isOpen) {
      // Chat is open - ensure visible, fade in quickly
      return `
        opacity: 1;
        transition: opacity 0.125s ease;
        transition-delay: 0s;
      `;
    } else if (ageInSeconds < 7) {
      // Message is fresh - calculate remaining delay before fade
      const remainingDelay = Math.max(0, 7 - ageInSeconds);
      return `
        opacity: 0;
        transition: opacity 3s ease;
        transition-delay: ${remainingDelay}s;
      `;
    } else if (ageInSeconds < 10) {
      // Message is fading - calculate remaining fade
      const remainingFade = Math.max(0.5, 3 - (ageInSeconds - 7));
      return `
        opacity: 0;
        transition: opacity ${remainingFade}s ease;
        transition-delay: 0s;
      `;
    } else {
      // Message is old (>10s) - fade out quickly
      return `
        opacity: 0;
        transition: opacity 0.5s ease;
        transition-delay: 0s;
      `;
    }
  }};
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
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});

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

  // Detect new messages and trigger a re-render on next frame
  useEffect(() => {
    const newMessages = chatLog.filter((log) =>
      !seenMessagesRef.current.has(log.id)
    );
    if (newMessages.length > 0) {
      newMessages.forEach((log) => seenMessagesRef.current.add(log.id));
      requestAnimationFrame(() => forceUpdate({}));
    }
  }, [chatLog]);

  const now = Date.now();

  return (
    <ChatContainer>
      {chatLog.filter((log) => showChatBox || (now - log.timestamp < 10_000))
        .map((log) => (
          <ChatMessage
            key={log.id}
            $showChat={showChatBox}
            $messageAge={now - log.timestamp}
            $isNew={!seenMessagesRef.current.has(log.id)}
          >
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
