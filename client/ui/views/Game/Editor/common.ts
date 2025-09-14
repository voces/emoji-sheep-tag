import { Card } from "@/components/layout/Card.tsx";
import { styled } from "styled-components";

export const Panel = styled(Card)`
  pointer-events: auto;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
`;
