import "styled-components";
import { type AppTheme } from "./ui/theme.ts";

declare global {
  // Deno 2.8 includes the Node lib by default, which types setTimeout/
  // setInterval as returning NodeJS.Timeout. The client runs in the browser
  // where they return number; re-pin the browser signatures.
  function setTimeout(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): number;
  function setInterval(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): number;
}

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
