// styled.d.ts
import "styled-components";

// esbuild `define` replaces these expressions at build time
declare global {
  const process: {
    env: {
      NODE_ENV: string;
      BUILD_TIME: string;
    };
  };
}

declare module "styled-components" {
  export interface DefaultTheme {
    colors: {
      // Game colors
      pink: string;
      blue: string;
      green: string;
      orange: string;
      purple: string;
      gold: string;
      mana: string;

      // UI colors
      primary: string;
      body: string;
      background: string;
      border: string;
      shadow: string;
    };

    spacing: {
      xs: "2px";
      sm: "4px";
      md: "8px";
      lg: "16px";
      xl: "24px";
      xxl: "32px";
    };

    borderRadius: {
      sm: string;
      md: string;
      lg: string;
    };

    shadows: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
    };

    fontSize: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };

    lineHeight: {
      tight: string;
      normal: string;
      loose: string;
    };

    fontFamily: {
      sans: string;
    };
  }
}
