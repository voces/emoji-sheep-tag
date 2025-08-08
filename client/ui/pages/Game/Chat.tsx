//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { makeVar, useReactiveVar } from "@/hooks/useVar.tsx";
import { send } from "../../../client.ts";
import { ColorMarkdown } from "@/components/Markdown.tsx";
import { chatLogVar, chatValueVar } from "@/vars/chat.ts";

export const showChatBoxVar = makeVar<"closed" | "open" | "sent" | "dismissed">(
  "closed",
);

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
    <div id="chat">
      {chatLog.filter((log) => now - log.timestamp < 10_000).map((log) => (
        <div key={log.id}>
          <ColorMarkdown text={log.message} />
        </div>
      ))}
      <input
        autoFocus
        className={showChatBox}
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
    </div>
  );
};
