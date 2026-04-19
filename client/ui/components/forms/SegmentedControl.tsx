import { styled } from "styled-components";

export const SegmentedControl = styled.div`
  display: inline-flex;
  background: ${({ theme }) => theme.surface[2]};
  border: 1px solid ${({ theme }) => theme.border.DEFAULT};
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 2px;
  gap: 1px;
`;

export const Segment = styled.button<{ $active?: boolean }>`
  background: ${({ $active, theme }) =>
    $active ? theme.surface[0] : "transparent"};
  border: none;
  color: ${({ $active, theme }) => $active ? theme.ink.hi : theme.ink.mid};
  padding: 5px 12px;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;
  border-radius: calc(${({ theme }) => theme.radius.sm} - 2px);
  transition: all ${({ theme }) => theme.motion.fast} ${({ theme }) =>
    theme.motion.easeOut};
  cursor: pointer;
  box-shadow: ${({ $active }) =>
    $active ? "0 1px 2px rgba(0,0,0,0.3)" : "none"};

  &.hover {
    color: ${({ theme }) => theme.ink.hi};
  }
`;

export const SegmentedControlWide = styled(SegmentedControl)`
  display: grid;
  width: 100%;
`;
