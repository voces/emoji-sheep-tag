import { styled } from "styled-components";
import { Overlay } from "./Layout.tsx";
import { Card } from "./Card.tsx";

const DialogCard = styled(Card)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

type DialogProps = {
  children: React.ReactNode;
  className?: string;
};

export const Dialog = ({ children, className }: DialogProps) => (
  <Overlay data-overlay="true">
    <DialogCard className={className}>{children}</DialogCard>
  </Overlay>
);
