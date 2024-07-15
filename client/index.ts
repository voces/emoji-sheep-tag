import "./client.ts";
import "./ui/root.tsx";
import "./controls.ts";
import "./systems/lookup.ts";
import "./systems/autoSelect.ts";
import "./systems/three.ts";
import "./systems/movement.ts";

globalThis.addEventListener("error", (e) => {
  // Add non-interrupting error notifs
  // alert(e.message);
});
