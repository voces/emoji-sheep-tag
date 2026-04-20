import "styled-components";
import { type AppTheme } from "./ui/theme.ts";

// esbuild `define` replaces these expressions at build time
declare global {
  const process: {
    env: {
      NODE_ENV: string;
    };
  };
}

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
