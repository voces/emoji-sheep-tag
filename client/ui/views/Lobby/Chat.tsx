import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import {
  chatChannelVar,
  chatLogVar,
  chatValueVar,
  toggleChatChannel,
} from "@/vars/chat.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { send } from "../../../client.ts";
import { Card } from "@/components/layout/Card.tsx";

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

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 12));
  color: ${({ theme }) => theme.colors.border};

  &:has(.hover:not([disabled])) {
    background: hsl(from ${({ theme }) => theme.colors.body} h s calc(l - 5));
  }

  &:has(:focus:not([disabled])) {
    background-color: white;
    box-shadow: #222 1px 1px 4px 1px;
  }

  &:has(:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ChannelButton = styled.button`
  background: none;
  border: none;
  font-size: inherit;
  padding: 4px 0.25em 4px 8px;
  white-space: nowrap;
  color: hsl(from ${({ theme }) => theme.colors.border} h s calc(l + 35));

  &.hover {
    color: ${(p) => p.theme.colors.border};
  }
`;

const ChatInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: inherit;
  padding: 4px 8px 4px 0;

  &:focus:not([disabled]) {
    box-shadow: none;
  }
`;

export const Chat = () => {
  const chatLog = useReactiveVar(chatLogVar);
  const chatValue = useReactiveVar(chatValueVar);
  const chatChannel = useReactiveVar(chatChannelVar);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const [disabled, setDisabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useLayoutEffect(() => {
    const timeout = setTimeout(() => setDisabled(false), 250);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

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
      <InputWrapper>
        <ChannelButton
          onClick={() => {
            toggleChatChannel();
            inputRef.current?.focus();
          }}
          title="Tab to switch"
        >
          [{chatChannel === "all" ? "All" : "Allies"}]
        </ChannelButton>
        <ChatInput
          ref={inputRef}
          maxLength={150}
          value={chatValue}
          disabled={disabled}
          onInput={(e) => chatValueVar(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") return toggleChatChannel();
            if (!e.code.includes("Enter") || !e.currentTarget.value) return;
            send({
              type: "chat",
              message: e.currentTarget.value,
              channel: chatChannel,
            });
            chatValueVar("");
          }}
        />
      </InputWrapper>
    </ChatCard>
  );
};
