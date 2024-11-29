import { mouse } from "../mouse.ts";

mouse.addEventListener("mouseMove", (e) => {
  document.body.style.cursor = e.intersects.size ? "pointer" : "default";
});
