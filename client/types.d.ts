import "styled-components";
import { type AppTheme } from "./ui/theme.ts";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
