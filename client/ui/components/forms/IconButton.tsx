import { styled } from "styled-components";

export const IconButton = styled.button`
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  opacity: var(--icon-button-opacity, 0.5);
  transition: opacity 0.15s, filter 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  filter: drop-shadow(0 0 2px #fff6);

  &.hover {
    opacity: 1;
    filter: drop-shadow(0 0 3px #fff);
  }

  &.active {
    opacity: 1;
    filter: drop-shadow(0 0 4px #fff);
  }
`;
