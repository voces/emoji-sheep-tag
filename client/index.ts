import "./client.ts";
import "./ui/root.tsx";
import "./controls.ts";
import "./systems/lookup.ts";
import "./systems/autoSelect.ts";
import "./systems/three.ts";
import "./systems/movement.ts";
import "./systems/attack.ts";
import "./systems/sounds.ts";
import "./systems/blueprints.ts";
import "./systems/fire.ts";
import "./systems/swing.ts";
import "./systems/kaboom.ts";
import "./systems/orderIndicators.ts";
import "./graphics/cursor.ts";

globalThis.addEventListener("error", (e) => {
  // Add non-interrupting error notifs
  // alert(e.message);
});
