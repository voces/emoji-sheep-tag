import { styled } from "styled-components";

export const BaseBarContainer = styled.div`
  position: relative;
  background: ${({ theme }) => theme.surface[0]};
  border: 1px solid ${({ theme }) => theme.border.soft};
  border-radius: ${({ theme }) => theme.radius.xs};
  overflow: hidden;
`;

export type BarProps = {
  value: number;
  max: number;
  color: string;
  width?: number;
  height?: number;
};
