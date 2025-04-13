import { loadLocal } from "../../local.ts";
import { connect } from "../../client.ts";
import { showSettingsVar } from "../vars/showSettings.ts";

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
        Offline
      </button>
      <button onClick={connect}>
        Multiplayer
      </button>
      <button onClick={() => showSettingsVar(true)}>
        Settings
      </button>
    </div>
  </div>
);
