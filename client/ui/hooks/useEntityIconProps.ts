import { isAlly } from "@/shared/api/unit.ts";
import { Entity } from "../../ecs.ts";
import { useLocalPlayer } from "./usePlayers.ts";
import { iconEffects } from "@/components/SVGIcon.tsx";
import { getPlayer } from "@/shared/api/player.ts";
import { Command } from "@/components/game/Command.tsx";
import { useMemo } from "react";

export const useEntityIconProps = (entity: Entity | undefined) => {
  const localPlayer = useLocalPlayer();

  return useMemo(() => {
    if (!entity) return;

    const iconEffect = entity.iconEffect ??
      (entity.isMirror && localPlayer && isAlly(entity, localPlayer.id)
        ? "mirror"
        : undefined);

    const iconEffectProps = iconEffect
      ? iconEffects[iconEffect](entity.owner)
      : (entity.alpha ? { style: { opacity: entity.alpha } } : undefined);
    const accentColor = entity.playerColor ??
      getPlayer(entity.owner)?.playerColor ??
      undefined;
    const iconProps: React.ComponentProps<typeof Command>["iconProps"] = {
      ...iconEffectProps,
      accentColor,
    };
    if (
      entity.vertexColor && iconProps &&
      !iconProps.overlayStyle?.backgroundColor
    ) {
      iconProps.overlayStyle = {
        ...iconProps.overlayStyle,
        backgroundColor: `#${entity.vertexColor.toString(16).padStart(6, "0")}`,
      };
    }

    return iconProps;
  }, [
    entity?.iconEffect,
    entity?.isMirror,
    entity?.owner,
    entity?.alpha,
    entity?.playerColor,
    entity?.vertexColor,
  ]);
};
