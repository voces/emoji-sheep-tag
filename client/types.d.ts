// styled.d.ts
import "npm:styled-components";

declare module "npm:styled-components" {
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
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      xxl: string;
    };

    borderRadius: {
      sm: string;
      md: string;
      lg: string;
    };

    shadows: {
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
