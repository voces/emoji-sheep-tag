import { styled } from "styled-components";
//@deno-types="npm:@types/react"
import { useCallback, useEffect, useRef, useState } from "react";
import { mouse, MouseButtonEvent, MouseMoveEvent } from "../../../mouse.ts";

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const SliderLabel = styled.label`
  font-size: ${({ theme }) => theme.fontSize.md};
  color: ${({ theme }) => theme.colors.body};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SliderTrack = styled.div`
  position: relative;
  width: 100%;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
`;

const SliderRail = styled.div`
  width: 100%;
  height: 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.border};
`;

const SliderThumb = styled.div<{ $position: number; $hover: boolean }>`
  position: absolute;
  left: ${({ $position }) => `calc(${$position * 100}% - ${$position * 16}px)`};
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primary};
  border: 2px solid ${({ theme }) => theme.colors.body};
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s ease;
  transform: ${({ $hover }) => $hover ? "scale(1.1)" : "scale(1)"};
`;

const SliderValue = styled.span`
  font-size: ${({ theme }) => theme.fontSize.sm};
  color: ${({ theme }) => theme.colors.body};
  min-width: 3ch;
  text-align: right;
`;

export const Slider = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const rafRef = useRef<number>(undefined);

  // Sync local value with prop value when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const updateValue = useCallback((mouseX: number) => {
    if (!trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(
      0,
      Math.min(1, (mouseX - rect.left) / rect.width),
    );
    const newValue = min + percentage * (max - min);

    // Apply step rounding
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));

    // Round to avoid floating point precision issues (e.g. 0.70000000000001)
    const roundedValue = Math.round(clampedValue * 100) / 100;

    // Update local value immediately for smooth UI
    setLocalValue(roundedValue);

    // Debounce the actual onChange call using RAF
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      onChange(roundedValue);
    });
  }, [min, max, step, onChange]);

  const checkHover = () => {
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const mouseX = mouse.pixels.x;
      const mouseY = mouse.pixels.y;

      if (
        mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom
      ) return true;
    }

    if (thumbRef.current) {
      const rect = thumbRef.current.getBoundingClientRect();
      const mouseX = mouse.pixels.x;
      const mouseY = mouse.pixels.y;

      if (
        mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom
      ) return true;
    }

    return false;
  };

  // Handle mouse down (only when hovering)
  useEffect(() => {
    const handleMouseDown = (e: MouseButtonEvent) => {
      if (e.button === "left" && checkHover()) {
        setIsDragging(true);
        updateValue(mouse.pixels.x);
      }
    };

    mouse.addEventListener("mouseButtonDown", handleMouseDown);
    return () => mouse.removeEventListener("mouseButtonDown", handleMouseDown);
  }, [updateValue]);

  // Handle mouse up and move (only when dragging)
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseUp = (e: MouseButtonEvent) => {
      if (e.button === "left") {
        setIsDragging(false);
        // Ensure final value is synced
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          onChange(localValue);
        }
      }
    };

    const handleMouseMove = (_e: MouseMoveEvent) => {
      updateValue(mouse.pixels.x);
    };

    mouse.addEventListener("mouseButtonUp", handleMouseUp);
    mouse.addEventListener("mouseMove", handleMouseMove);

    return () => {
      mouse.removeEventListener("mouseButtonUp", handleMouseUp);
      mouse.removeEventListener("mouseMove", handleMouseMove);
    };
  }, [isDragging, updateValue, onChange, localValue]);

  // Handle hover state - only check on mouse move, not every frame
  useEffect(() => {
    const handleMouseMove = () => {
      setIsHovering(checkHover());
    };

    mouse.addEventListener("mouseMove", handleMouseMove);
    return () => mouse.removeEventListener("mouseMove", handleMouseMove);
  }, []);

  const displayValue = isDragging ? localValue : value;
  const normalizedValue = Math.max(
    0,
    Math.min(1, (displayValue - min) / (max - min)),
  );

  return (
    <SliderContainer>
      <SliderLabel>
        {label}
        <SliderValue>{Math.round(displayValue * 100)}%</SliderValue>
      </SliderLabel>
      <SliderTrack ref={trackRef}>
        <SliderRail />
        <SliderThumb
          ref={thumbRef}
          $position={normalizedValue}
          $hover={isHovering || isDragging}
        />
      </SliderTrack>
    </SliderContainer>
  );
};
