// @deno-types="npm:@types/react-dom/client"
import { createRoot } from "npm:react-dom/client";
import { App } from "./App.tsx";

const main = document.querySelector("div#main");
if (!main) throw new Error("Could not find main");

const root = createRoot(main);
root.render(<App />);
