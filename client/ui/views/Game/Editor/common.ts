import { Card } from "@/components/layout/Card.tsx";
import { styled } from "styled-components";

export const Panel = styled(Card)`
  pointer-events: auto;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
  padding: ${({ theme }) => theme.space[4]} ${({ theme }) => theme.space[1]};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
`;
