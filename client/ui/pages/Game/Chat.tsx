//@deno-types="npm:@types/react"
import { useEffect, useRef } from "react";
import { makeVar, useReactiveVar } from "../../hooks/useVar.tsx";
import { send } from "../../../client.ts";
import { ColorMarkdown } from "../../components/Markdown.tsx";

const chatLogVar = makeVar<{ id: string; message: string }[]>([]);
export const addChatMessage = (message: string) => {
  chatLogVar(
    (log) => [...log, {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
    }],
  );
  setTimeout(() => chatLogVar((log) => log.slice(1)), 10000);
};

export const showChatBoxVar = makeVar<"closed" | "open" | "sent" | "dismissed">(
  "closed",
);

export const Chat = () => {
  const chatLog = useReactiveVar(chatLogVar);
  const showChatBox = useReactiveVar(showChatBoxVar);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showChatBox === "open") inputRef.current?.focus();
    else inputRef.current?.blur();

    if (showChatBox === "sent") {
      if (inputRef.current) {
        send({ type: "chat", message: inputRef.current.value });
        inputRef.current.value = "";
      }
      showChatBoxVar("closed");
    }

    if (showChatBox === "dismissed" && inputRef.current?.value === "") {
      showChatBoxVar("closed");
    }
  }, [showChatBox]);

  return (
    <div id="chat">
      {chatLog.map((log) => (
        <div key={log.id}>
          <ColorMarkdown text={log.message} />
        </div>
      ))}
      <input className={showChatBox} ref={inputRef} maxLength={150} />
    </div>
  );
};
