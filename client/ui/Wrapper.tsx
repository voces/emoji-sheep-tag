import { ThemeProvider } from "styled-components";
import { theme } from "./theme.ts";
import { GlobalStyle } from "./GlobalStyle.ts";
import { Fragment, StrictMode } from "react";

export const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const MaybeStrictMode = typeof location !== "undefined" &&
      location.hostname === "localhost"
    ? StrictMode
    : Fragment;

  return (
    <MaybeStrictMode>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        {children}
      </ThemeProvider>
    </MaybeStrictMode>
  );
};
