import { styled } from "npm:styled-components";
import React from "npm:@types/react";

export const ColorPicker = styled.input<
  React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLInputElement>,
    HTMLDivElement
  >
>({
  fontSize: "inherit",
  WebkitAppearance: "none",
  border: "none",
  padding: 0,
  width: "1cap",
  height: "1cap",
  "&::-webkit-color-swatch-wrapper": {
    padding: 0,
  },
  "&::-webkit-color-swatch": {
    border: "none",
  },
  "&:hover": {
    cursor: "pointer",
  },
});
ColorPicker.defaultProps = { type: "color" };
