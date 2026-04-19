import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: ${({ theme }) => theme.surface[0]};
    color: ${({ theme }) => theme.ink.hi};
    font-family: ${({ theme }) => theme.font.sans};
    font-size: ${({ theme }) => theme.text.md};
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow: hidden;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; }

  button { font: inherit; color: inherit; cursor: pointer; }
  input, select, textarea { font: inherit; color: inherit; outline: none; }

  :focus-visible { outline: none; }

  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
  p { text-wrap: pretty; }
  h1, h2, h3, h4, h5, h6 { text-wrap: balance; }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  kbd {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.85em;
    background: ${({ theme }) => theme.surface[2]};
    border: 1px solid ${({ theme }) => theme.border.DEFAULT};
    border-bottom-width: 2px;
    border-radius: ${({ theme }) => theme.radius.xs};
    padding: 1px 5px;
    color: ${({ theme }) => theme.ink.mid};
    display: inline-block;
    line-height: 1;
    letter-spacing: 0.02em;
  }

  ::selection {
    background: ${({ theme }) => theme.accent.bg};
    color: ${({ theme }) => theme.ink.hi};
  }

  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.border.DEFAULT};
    border-radius: 10px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.border.hi};
    background-clip: content-box;
    border: 2px solid transparent;
  }

  canvas { position: absolute; }

  #ui {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  #cursor {
    position: absolute;
    width: 24px;
    height: 24px;
    z-index: 10000;
    pointer-events: none;
    visibility: hidden;
  }

  #cursor.entity {
    filter: hue-rotate(90deg);
  }

  @keyframes fadeOut {
    to { opacity: 0; }
  }
`;
