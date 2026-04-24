import { ReactNode, useRef, useState } from "react";
import { styled } from "styled-components";
import { ChevronDown, ChevronRight } from "lucide-react";
import Collapse from "@/components/layout/Collapse.tsx";
import { Panel } from "./common.ts";

const Header = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.ink.hi};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  border-radius: ${({ theme }) => theme.radius.md};

  &.hover {
    background: ${({ theme }) => theme.surface[2]};
  }
`;

const Chev = styled.span`
  color: ${({ theme }) => theme.ink.lo};
  display: inline-flex;
  align-items: center;
`;

const ScrollArea = styled.div`
  overflow-y: auto;
  min-height: 0;
`;

const Body = styled.div`
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]} ${(
    { theme },
  ) => theme.space[3]};
`;

export const CollapsiblePanel = (
  { title, defaultOpen = false, overflow, children }: {
    title: string;
    defaultOpen?: boolean;
    overflow?: "visible";
    children: ReactNode;
  },
) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasBeenOpened = useRef(defaultOpen);
  if (isOpen) hasBeenOpened.current = true;

  return (
    <Panel style={overflow ? { overflow } : undefined}>
      <Header onClick={() => setIsOpen(!isOpen)}>
        <Chev>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Chev>
        {title}
      </Header>
      <ScrollArea>
        <Collapse isOpen={isOpen}>
          {hasBeenOpened.current && <Body>{children}</Body>}
        </Collapse>
      </ScrollArea>
    </Panel>
  );
};
