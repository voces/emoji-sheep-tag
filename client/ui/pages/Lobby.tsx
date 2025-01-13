import { useReactiveVar } from "../hooks/useVar.tsx";
import { getLocalPlayer, Player, playersVar } from "../vars/players.ts";
import { ColorPicker } from "../components/ColorPicker.tsx";
import { send } from "../../client.ts";

const PlayerRow = ({ name, color }: Player) => (
  <div className="h-stack" style={{ alignItems: "center" }}>
    <ColorPicker
      value={color}
      onChange={(e) => {
        send({ type: "generic", event: { type: "colorChange", color: e } });
      }}
    />
    <span>{name}</span>
  </div>
);

const Players = () => {
  const players = useReactiveVar(playersVar);

  return (
    <div className="card" style={{ width: "60%", overflow: "auto" }}>
      <div>Players</div>
      {players.map((p) => <PlayerRow key={p.name} {...p} />)}
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

export const Lobby = () => (
  <div
    className="abs-center h-stack"
    style={{ gap: 24, width: "min(95%, 800px)", height: "min(95%, 600px)" }}
  >
    <Players />
    <Settings />
  </div>
);
