import { styled } from "npm:styled-components";
import { getBoxShadow } from "./Card.ts";
//@deno-types="npm:@types/react"
import React, { useCallback, useEffect, useRef, useState } from "npm:react";
import { mouse, MouseButtonEvent } from "../../mouse.ts";
import { Card } from "./Card.ts";

const Container = styled(Card)(({ theme, color = "blue" }) => ({
  position: "static",
  color: "inherit",
  font: "inherit",
  padding: "16px 20px",
  borderRadius: 25,
  boxShadow: getBoxShadow(theme, color, 3),
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0))",
    borderRadius: 25,
    opacity: 0.7,
    pointerEvents: "none",
  },
}));

const Menu = styled(Card)({
  position: "absolute",
  zIndex: 10,
  width: "calc(100% - 48px)",
});

const renderOption = (
  option: unknown,
  placeholder?: React.ReactNode,
): React.ReactNode => {
  if (typeof option === "string") return option;
  if (option && typeof option === "object" && "label" in option) {
    return option.label as React.ReactNode;
  }
  return (option as React.ReactNode) ?? placeholder;
};

const getKey = (option: unknown) => {
  if (option && typeof option === "object" && "value" in option) {
    return option.value as React.Key;
  }
  return JSON.stringify(option);
};

const OptionWrapper = styled.div({
  "&.hover": {
    textShadow: "0 0 2px black, 0 0 3px black",
  },
});

const Option = <T,>(
  { option, onChange }: { option: T; onChange: (value: T) => void },
) => (
  <OptionWrapper onClick={() => onChange(option)}>
    {renderOption(option)}
  </OptionWrapper>
);

export const Select = <T,>(
  { color = "green", placeholder, value, onChange, options }: {
    color?: string;
    placeholder?: React.ReactNode;
    value: T | undefined;
    onChange: (value: T) => void;
    options: T[];
  },
) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const listener = (e: MouseButtonEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.element)) {
        close();
      }
    };
    mouse.addEventListener("mouseButtonDown", listener);
    return () => mouse.removeEventListener("mouseButtonDown", listener);
  }, []);

  const handleOnChange = useCallback((option: T) => {
    try {
      onChange(option);
    } catch {}
    close();
  }, [onChange, close]);

  return (
    <div ref={wrapperRef}>
      <Container color={color} onClick={open}>
        {renderOption(value, placeholder)}
      </Container>
      {isOpen && (
        <Menu>
          {options.map((o) => (
            <Option key={getKey(o)} option={o} onChange={handleOnChange} />
          ))}
        </Menu>
      )}
    </div>
  );
};
