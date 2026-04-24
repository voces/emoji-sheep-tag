import { Card } from "@/components/layout/Card.tsx";
import { styled } from "styled-components";

export const Panel = styled(Card)`
  pointer-events: auto;
  overflow: hidden;
  padding: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme }) => theme.border.soft};
  display: flex;
  flex-direction: column;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 44px);
  gap: ${({ theme }) => theme.space[1]};
  justify-content: center;
`;
