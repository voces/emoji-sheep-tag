import { styled } from "styled-components";
import { useReactiveVar } from "@/hooks/useVar.tsx";
import { stateVar } from "@/vars/state.ts";
import { lobbySettingsVar } from "@/vars/lobbySettings.ts";

const Overlay = styled.div<{ $fogDisabled: boolean }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  backdrop-filter: blur(5px) saturate(0.85);
  background:
    radial-gradient(
      ellipse at center,
      transparent 40%,
      rgba(0, 0, 0, ${(
        { $fogDisabled },
      ) => ($fogDisabled ? "0.35" : "0.55")}) 100%
    ),
    rgba(0, 0, 0, ${({ $fogDisabled }) => ($fogDisabled ? "0.25" : "0.45")});
`;

export const BackgroundOverlay = () => {
  const state = useReactiveVar(stateVar);
  const lobbySettings = useReactiveVar(lobbySettingsVar);
  if (state === "playing") return null;
  return <Overlay $fogDisabled={lobbySettings.view} />;
};
