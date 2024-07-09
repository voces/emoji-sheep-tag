import "./client.ts";
import "./ui/root.tsx";
import "./controls.ts";
import "./world.ts";

globalThis.addEventListener("error", (e) => {
  // Add non-interrupting error notifs
  // alert(e.message);
});
