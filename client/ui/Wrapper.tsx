import { ThemeProvider } from "styled-components";
import { theme } from "./theme.ts";

export const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);
