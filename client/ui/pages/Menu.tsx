import { loadLocal } from "../../local.ts";
import { connect } from "../../client.ts";

export const Menu = () => (
  <div className="card abs-center">
    <h1>Emoji Sheep Tag</h1>
    <div className="v-stack">
      <button
        onClick={() => {
          loadLocal();
          connect();
        }}
      >
        Single player
      </button>
      <button onClick={connect}>
        Multiplayer
      </button>
    </div>
  </div>
);
