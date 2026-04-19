import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { send } from "../../../messaging.ts";
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
  bottom: 220px;
  left: ${({ theme }) => theme.space[4]};
  pointer-events: none;
  font-size: ${({ theme }) => theme.text.lg};
`;

const ChatMessage = styled.div<{
  $showChat: string;
  $messageAge: number;
  $isNew: boolean;
}>`
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  line-height: 1.4;
  padding: 1px 0;

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
  width: 300px;
  border-radius: ${({ theme }) => theme.radius.sm};
  margin-top: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[2]};
  border: 1px solid transparent;
  pointer-events: ${({ $state }) => ($state === "closed" ? "none" : "auto")};
  opacity: ${({ $state }) =>
    $state === "closed" ? 0 : $state === "dismissed" ? 0.5 : 1};
  background: ${({ $state, theme }) =>
    $state === "open"
      ? `color-mix(in oklab, ${theme.surface[1]} 85%, transparent)`
      : $state === "dismissed"
      ? `color-mix(in oklab, ${theme.surface[1]} 40%, transparent)`
      : "transparent"};
  backdrop-filter: ${({ $state }) =>
    $state === "open"
      ? "blur(8px)"
      : $state === "dismissed"
      ? "blur(4px)"
      : "none"};
  border-color: ${({ $state, theme }) =>
    $state === "open" ? theme.border.soft : "transparent"};
  box-shadow: ${({ $state, theme }) =>
    $state === "open" ? theme.shadow.sm : "none"};
  transition:
    opacity ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    background ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut},
    border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
      theme.motion.easeOut};
`;

const ChannelButton = styled.button<{ $state: string }>`
  background: none;
  border: none;
  color: ${({ theme }) => theme.ink.lo};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.xs};
  padding: 0 ${({ theme }) => theme.space[1]};
  white-space: nowrap;
  cursor: pointer;
  transition: color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    color: ${({ theme }) => theme.ink.mid};
  }

  &.active {
    color: ${({ theme }) => theme.ink.hi};
  }
`;

const ChatInput = styled.input`
  background: transparent;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.sm};
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  outline: none;
  padding: 0 ${({ theme }) => theme.space[1]};
  border: 0;
  flex: 1;

  &:focus:not([disabled]) {
    background: transparent;
    box-shadow: none;
  }
`;

export const Chat = () => {
  const { t } = useTranslation();
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            toggleChatChannel();
            showChatBoxVar("open");
            inputRef.current?.focus();
          }}
          title={t("hud.chatTabToSwitch")}
        >
          [{chatChannel === "all" ? t("hud.chatAll") : t("hud.chatAllies")}]
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
          onBlur={() =>
            setTimeout(() => {
              if (showChatBoxVar() === "open") return;
              showChatBoxVar("dismissed");
            })}
        />
      </InputWrapper>
    </ChatContainer>
  );
};
