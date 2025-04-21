import { useReactiveVar } from "../hooks/useVar.tsx";
import { getLocalPlayer, Player, playersVar } from "../vars/players.ts";
import { ColorPicker } from "../components/ColorPicker.tsx";
import { send } from "../../client.ts";
//@deno-types="npm:@types/react"
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { roundsVar } from "../vars/rounds.ts";
import { formatDuration } from "../util/formatDuration.ts";
import { chatLogVar, chatValueVar } from "../vars/chat.ts";
import { ColorMarkdown } from "../components/Markdown.tsx";
import { formatVar } from "../vars/format.ts";

const PlayerRow = ({ name, color, id }: Player) => (
  <div className="h-stack" style={{ alignItems: "center" }}>
    <ColorPicker
      value={color}
      onChange={(e) => {
        send({ type: "generic", event: { type: "colorChange", color: e } });
      }}
      readonly={id !== getLocalPlayer()?.id}
    />
    <span>{name}</span>
  </div>
);

const Players = () => {
  const players = useReactiveVar(playersVar);
  const rounds = useReactiveVar(roundsVar);
  const format = useReactiveVar(formatVar);

  return (
    <div
      className="card"
      style={{ overflow: "auto", flex: 1 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "4px 8px",
          alignItems: "start",
        }}
      >
        <div>Players</div>
        <div style={{ textAlign: "right" }}>Sheep count</div>
        <div style={{ textAlign: "right" }}>Average time</div>
        {players.map((p) => {
          const playerRounds = rounds.filter((r) =>
            r.sheep.includes(p.id) && r.sheep.length === format.sheep &&
            r.wolves.length === format.wolves
          );

          return (
            <Fragment key={p.name}>
              <PlayerRow {...p} />
              <div style={{ textAlign: "right" }}>
                {p.sheepCount}
              </div>
              <div style={{ textAlign: "right" }}>
                {playerRounds.length
                  ? formatDuration(
                    playerRounds.reduce((sum, r) => sum + r.duration, 0) /
                      playerRounds.length,
                    true,
                  )
                  : "-"}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};

const Settings = () => {
  useReactiveVar(playersVar); // update when host changes
  return (
    <div
      className="card v-stack"
      style={{ width: "40%", flexDirection: "column-reverse" }}
    >
      <button
        onClick={() => send({ type: "start" })}
        disabled={!getLocalPlayer()?.host}
      >
        Start
      </button>
    </div>
  );
};

const Chat = () => {
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
    <div
      className="card v-stack"
      style={{
        height: 200,
        paddingTop: 0,
        maxHeight: `calc(100vh - 300px)`,
        minHeight: 85,
      }}
    >
      <div
        style={{
          overflow: "auto",
          marginTop: "auto",
          marginRight: -16,
          paddingRight: 16,
        }}
        ref={chatLogRef}
        onScroll={handleScroll}
      >
        {chatLog.map((log) => (
          <div key={log.id}>
            <ColorMarkdown text={log.message} />
          </div>
        ))}
      </div>
      <input
        id="lobby-chat"
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
    </div>
  );
};

export const Lobby = () => (
  <div
    className="abs-center h-stack positional"
    style={{ gap: 24, width: "min(95%, 900px)", height: "min(95%, 800px)" }}
  >
    <div className="v-stack positional" style={{ width: "60%", gap: 24 }}>
      <Players />
      <Chat />
    </div>
    <Settings />
  </div>
);
