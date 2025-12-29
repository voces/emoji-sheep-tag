import { useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { send } from "../../../client.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import {
  chatChannelVar,
  chatLogVar,
  chatValueVar,
  toggleChatChannel,
} from "@/vars/chat.ts";
import { showChatBoxVar } from "@/vars/showChatBox.ts";

const ChatContainer = styled.div`
  position: absolute;
  bottom: 195px;
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
      // Message is fresh - stay visible, will fade after delay
      return `
        opacity: 1;
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

const InputWrapper = styled.div<{ $state: string }>`
  display: flex;
  align-items: center;
  opacity: ${({ $state }) => ($state === "closed" ? 0 : 1)};
  transition: all 100ms ease-in-out;
  width: 300px;

  ${({ $state, theme }) =>
    $state === "open" && `
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

const ChannelButton = styled.button<{ $state: string }>`
  background: none;
  border: none;
  color: inherit;
  font-size: inherit;
  padding: 0 0.25em 0 4px;
  white-space: nowrap;
  pointer-events: ${({ $state }) => ($state === "open" ? "auto" : "none")};
  opacity: 0.6;

  &.hover {
    opacity: 1;
  }
`;

const ChatInput = styled.input`
  background: transparent;
  color: inherit;
  text-shadow: 0 0 2px ${({ theme }) => theme.colors.border};
  transition: all 100ms ease-in-out;
  outline: none;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  flex: 1;

  &:focus:not([disabled]) {
    background: transparent;
    box-shadow: none;
  }
`;

export const Chat = () => {
  const chatLog = useReactiveVar(chatLogVar);
  const showChatBox = useReactiveVar(showChatBoxVar);
  const chatValue = useReactiveVar(chatValueVar);
  const chatChannel = useReactiveVar(chatChannelVar);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});

  useEffect(() => {
    if (showChatBox === "open") inputRef.current?.focus();
    else inputRef.current?.blur();

    if (showChatBox === "sent") {
      if (inputRef.current?.value) {
        send({
          type: "chat",
          message: inputRef.current.value,
          channel: chatChannel,
        });
        chatValueVar("");
      }
      showChatBoxVar("closed");
    }

    if (showChatBox === "dismissed" && inputRef.current?.value === "") {
      showChatBoxVar("closed");
    }
  }, [showChatBox, chatChannel]);

  // Track which messages are new for this render
  const newMessageIds = chatLog
    .filter((log) => !seenMessagesRef.current.has(log.id))
    .map((log) => log.id);

  // Mark messages as seen and trigger re-render after paint
  useEffect(() => {
    if (newMessageIds.length > 0) {
      newMessageIds.forEach((id) => seenMessagesRef.current.add(id));
      requestAnimationFrame(() => forceUpdate({}));
    }
  }, [newMessageIds.join(",")]);

  const now = Date.now();

  // Schedule re-renders for fade timing
  useEffect(() => {
    if (showChatBox === "open" || showChatBox === "dismissed") return;

    const timers: number[] = [];
    for (const log of chatLog) {
      const age = now - log.timestamp;
      // Schedule re-render at 7s mark to start fade
      if (age < 7000) {
        timers.push(setTimeout(() => forceUpdate({}), 7000 - age + 50));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [chatLog, showChatBox]);

  return (
    <ChatContainer>
      {chatLog.filter((
        log,
      ) => (now - log.timestamp < (showChatBox ? 60_000 : 10_000)))
        .map((log) => (
          <ChatMessage
            key={log.id}
            $showChat={showChatBox}
            $messageAge={now - log.timestamp}
            $isNew={newMessageIds.includes(log.id)}
          >
            <ColorMarkdown text={log.message} />
          </ChatMessage>
        ))}
      <InputWrapper $state={showChatBox}>
        <ChannelButton
          $state={showChatBox}
          onClick={() => {
            toggleChatChannel();
            showChatBoxVar("open");
            inputRef.current?.focus();
          }}
          title="Tab to switch"
        >
          [{chatChannel === "all" ? "All" : "Allies"}]
        </ChannelButton>
        <ChatInput
          autoFocus
          ref={inputRef}
          maxLength={150}
          value={chatValue}
          onInput={(e) => chatValueVar(e.currentTarget.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Tab") {
              e.preventDefault();
              return toggleChatChannel();
            }
            if (e.code !== "Enter") return;
            showChatBoxVar("sent");
          }}
          onBlur={() => showChatBoxVar("dismissed")}
        />
      </InputWrapper>
    </ChatContainer>
  );
};
