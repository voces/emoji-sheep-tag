// styled.d.ts
import "styled-components";

declare module "styled-components" {
  export interface DefaultTheme {
    colors: {
      pink: string;
      blue: string;
      green: string;
      orange: string;
      purple: string;
    };
  }
}
