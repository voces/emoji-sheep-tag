import { ReactNode, useState } from "react";
import { styled } from "styled-components";
import { Panel } from "./common.ts";

const Header = styled.h4`
  cursor: pointer;
  user-select: none;
  margin: 0;
`;

const Icon = styled.span`
  display: inline-block;
  width: 1.5ch;
  margin-right: ${({ theme }) => theme.spacing.sm};
`;

export const CollapsiblePanel = (
  { title, defaultOpen = false, children }: {
    title: string;
    defaultOpen?: boolean;
    children: ReactNode;
  },
) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Panel>
      <Header onClick={() => setIsOpen(!isOpen)}>
        <Icon>{isOpen ? "▼" : "▶"}</Icon>
        {title}
      </Header>
      {isOpen && children}
    </Panel>
  );
};
