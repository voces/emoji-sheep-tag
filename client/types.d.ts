// styled.d.ts
import "npm:styled-components";

declare module "npm:styled-components" {
  export interface DefaultTheme {
    colors: {
      pink: string;
      blue: string;
      green: string;
      orange: string;
      purple: string;
      gold: string;
    };
  }
}
