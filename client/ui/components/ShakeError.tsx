import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { keyframes, styled } from "styled-components";

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  90% { transform: translateX(1px); }
`;

const fadeUp = keyframes`
  0% { opacity: 0; margin-bottom: -4px; }
  15% { opacity: 1; margin-bottom: 0; }
  85% { opacity: 1; margin-bottom: 0; }
  100% { opacity: 0; margin-bottom: 4px; }
`;

const Wrapper = styled.div`
  display: inline-flex;

  &.shake {
    animation: ${shake} 0.4s ease;
  }
`;

const Bubble = styled.div`
  position: fixed;
  white-space: nowrap;
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.danger.DEFAULT};
  background: ${({ theme }) => theme.surface[1]};
  border: 1px solid
    color-mix(
      in oklab,
      ${({ theme }) => theme.danger.DEFAULT} 35%,
      ${({ theme }) => theme.border.DEFAULT}
    );
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[3]};
  box-shadow: ${({ theme }) => theme.shadow.md};
  pointer-events: none;
  animation: ${fadeUp} 2.5s ease forwards;
  z-index: 9999;
`;

export const useShakeError = () => {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);

  const showError = useCallback((msg: string) => {
    clearTimeout(timerRef.current);
    setError(msg);
    setErrorKey((k) => k + 1);

    const el = ref.current;
    if (el) {
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
    }

    timerRef.current = setTimeout(() => {
      setError(null);
      ref.current?.classList.remove("shake");
    }, 2500);
  }, []);

  const errorBubble = error && ref.current
    ? createPortal(
      (() => {
        const rect = ref.current!.getBoundingClientRect();
        return (
          <Bubble
            key={errorKey}
            style={{
              bottom: globalThis.innerHeight - rect.top + 8,
              left: rect.left + rect.width / 2,
              transform: "translateX(-50%)",
            }}
          >
            {error}
          </Bubble>
        );
      })(),
      document.body,
    )
    : null;

  return { ref, showError, errorBubble, Wrapper };
};
