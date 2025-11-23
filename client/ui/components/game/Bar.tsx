import { styled } from "styled-components";

export const BaseBarContainer = styled.div`
  position: relative;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  box-shadow: rgba(0, 0, 0, 0.3) ${({ theme }) => theme.shadows.xs};
  overflow: hidden;
`;

export type BarProps = {
  value: number;
  max: number;
  color: string;
  width?: number;
  height?: number;
};
