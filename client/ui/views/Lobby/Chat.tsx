import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import {
  chatChannelVar,
  chatLogVar,
  chatValueVar,
  toggleChatChannel,
} from "@/vars/chat.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { send } from "../../../messaging.ts";

const ChatContainer = styled.div`
  margin: 0 calc(-1 * ${({ theme }) => theme.space[4]});
  padding: ${({ theme }) => theme.space[3]} ${({ theme }) => theme.space[4]} ${(
    { theme },
  ) => theme.space[4]};
  background: ${({ theme }) => theme.surface[0]};
  border-top: 1px solid ${({ theme }) => theme.border.soft};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-height: 0;
  max-height: 160px;
  flex-shrink: 0;
`;

const ChatLog = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 4px;
  margin-top: auto;
`;

const ChatLine = styled.div`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.ink.mid};
  line-height: 1.4;
`;

const ChatInputRow = styled.form`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const ChatPrefix = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.ink.lo};
  padding: 0 2px;
  cursor: pointer;

  &.hover {
    color: ${({ theme }) => theme.ink.mid};
  }
`;

const ChatInput = styled.input`
  flex: 1;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 7px 10px;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.sm};
  outline: none;
  transition: border-color ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};

  &.hover {
    border-color: ${({ theme }) => theme.border.hi};
  }

  &:focus {
    border-color: ${({ theme }) => theme.accent.DEFAULT};
    background: ${({ theme }) => theme.surface[1]};
    box-shadow: none;
  }
`;

export const Chat = () => {
  const { t } = useTranslation();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatValue.trim()) return;
    send({ type: "chat", message: chatValue, channel: chatChannel });
    chatValueVar("");
  };

  return (
    <ChatContainer>
      <ChatLog ref={chatLogRef} onScroll={handleScroll}>
        {chatLog.map((log) => (
          <ChatLine key={log.id}>
            <ColorMarkdown text={log.message} />
          </ChatLine>
        ))}
      </ChatLog>
      <ChatInputRow onSubmit={handleSubmit}>
        <ChatPrefix
          onClick={() => {
            toggleChatChannel();
            inputRef.current?.focus();
          }}
          title={t("hud.chatTabToSwitch")}
        >
          [{chatChannel === "all" ? t("lobby.chatAll") : t("lobby.chatAllies")}]
        </ChatPrefix>
        <ChatInput
          ref={inputRef}
          maxLength={150}
          value={chatValue}
          disabled={disabled}
          placeholder={t("lobby.chatPlaceholder")}
          onInput={(e) => chatValueVar(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              return toggleChatChannel();
            }
            if (!e.code.includes("Enter") || !e.currentTarget.value) return;
            send({
              type: "chat",
              message: e.currentTarget.value,
              channel: chatChannel,
            });
            chatValueVar("");
          }}
        />
      </ChatInputRow>
    </ChatContainer>
  );
};
