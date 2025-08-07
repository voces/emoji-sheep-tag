import { makeVar, useReactiveVar } from "../../hooks/useVar.tsx";
import { app, Entity } from "../../../ecs.ts";
import { selection } from "../../../systems/autoSelect.ts";
import { UnitDataAction } from "../../../../shared/types.ts";
import { items, prefabs } from "../../../../shared/data.ts";
import { getLocalPlayer, playersVar } from "../../vars/players.ts";
import { shortcutsVar } from "../Settings.tsx";
import { SvgIcon } from "../../components/SVGIcon.tsx";
import { useTooltip } from "../../hooks/useTooltip.tsx";
import { absurd } from "../../../../shared/util/absurd.ts";
import { useListenToEntityProp } from "../../hooks/useListenToEntityProp.ts";
import { styled } from "npm:styled-components";
import { formatShortcut } from "../../util/formatShortcut.ts";
import { getCurrentMenu, menuStateVar } from "../../vars/menuState.ts";

export const selectionVar = makeVar<Entity | undefined>(undefined);
selection.addEventListener(
  "add",
  (e) => selectionVar((v) => v?.selected && app.entities.has(v) ? v : e),
);
selection.addEventListener(
  "delete",
  (e) =>
    selectionVar((v) =>
      v !== e && v?.selected && app.entities.has(v) ? v : selection.first()
    ),
);

const GoldContainer = styled.div(({ theme }) => ({
  display: "flex",
  gap: 4,
  alignItems: "center",
  color: theme.colors.gold,
}));

const Command = (
  { name, icon, iconType, binding, iconScale, current, disabled, goldCost }: {
    name: string;
    icon?: string;
    iconType?: "svg";
    binding?: string[];
    iconScale?: number;
    current?: boolean;
    disabled?: boolean;
    goldCost?: number;
  },
) => {
  const { tooltipContainerProps, tooltip } = useTooltip(
    <div>
      <div>{name}</div>
      {(goldCost ?? 0) > 0 && (
        <GoldContainer>
          <span style={{ width: 24, height: 24, display: "inline-block" }}>
            <SvgIcon icon="gold" />
          </span>
          <span>{goldCost}</span>
        </GoldContainer>
      )}
    </div>,
  );

  const handleClick = () => {
    if (!binding?.length) return;

    for (const code of binding) {
      const event = new KeyboardEvent("keydown", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }

    for (const code of binding.toReversed()) {
      const event = new KeyboardEvent("keyup", {
        code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "fromHud", { value: true });
      document.dispatchEvent(event);
    }
  };

  return (
    <div
      className={[
        "command",
        current ? "current" : undefined,
        disabled ? "disabled" : undefined,
      ].filter(Boolean).join(" ")}
      onClick={handleClick}
      style={{
        filter: disabled ? "saturate(0.3) brightness(0.7)" : undefined,
        opacity: disabled ? 0.6 : undefined,
      }}
      {...tooltipContainerProps}
    >
      {iconType === "svg" && icon && (
        <SvgIcon
          icon={icon}
          color={getLocalPlayer()?.color}
          scale={iconScale}
        />
      )}
      {binding?.length && <div>{formatShortcut(binding)}</div>}
      {tooltip}
    </div>
  );
};

const iconMap: Record<string, string> = {
  destroyLastFarm: "collision",
  hold: "suspend",
  mirrorImage: "wolf",
  move: "route",
  stop: "stop",
  attack: "claw",
  selfDestruct: "collision",
  back: "stop",
  fox: "fox",
};

const Action = (
  { action, current, entity }: {
    action: UnitDataAction;
    current: boolean;
    entity: Entity;
  },
) => {
  // Check if action is disabled due to insufficient mana
  const manaCost = ("manaCost" in action ? action.manaCost : undefined) ?? 0;
  let disabled = manaCost > 0 && (entity.mana ?? 0) < manaCost;

  // Check if action is disabled due to insufficient gold (for build and purchase actions)
  if (action.type === "build" || action.type === "purchase") {
    const goldCost = action.goldCost ?? 0;
    // Find the owning player of the entity
    const owningPlayer = playersVar().find((p) => p.id === entity.owner);
    const playerGold = owningPlayer?.entity?.gold ?? 0;
    disabled = disabled || (goldCost > 0 && playerGold < goldCost);
  }

  switch (action.type) {
    case "auto":
    case "target":
      return (
        <Command
          name={action.name}
          iconType="svg"
          icon={iconMap[action.order] ?? action.order}
          binding={action.binding}
          current={current}
          disabled={disabled}
        />
      );
    case "build":
      return (
        <Command
          name={action.name}
          iconType="svg"
          icon={prefabs[action.unitType]?.model ?? action.unitType}
          iconScale={prefabs[action.unitType]?.modelScale}
          binding={action.binding}
          current={current}
          disabled={disabled}
          goldCost={action.goldCost}
        />
      );
    case "purchase":
      return (
        <Command
          name={action.name}
          iconType="svg"
          icon={items[action.itemId].icon ?? action.itemId}
          binding={action.binding}
          current={current}
          disabled={disabled}
          goldCost={action.goldCost}
        />
      );
    case "menu":
      return (
        <Command
          name={action.name}
          iconType="svg"
          icon="shop"
          binding={action.binding}
          current={current}
          disabled={disabled}
        />
      );
    default:
      absurd(action);
  }

  return null;
};

export const ActionBar = () => {
  const selection = useReactiveVar(selectionVar);
  useReactiveVar(shortcutsVar);
  useReactiveVar(menuStateVar);
  const currentMenu = getCurrentMenu();
  useListenToEntityProp(selection, "order");
  useListenToEntityProp(selection, "mana");
  useListenToEntityProp(selection, "inventory");

  // Listen to gold changes on the owning player's entity
  const owningPlayer = selection
    ? playersVar().find((p) => p.id === selection.owner)
    : undefined;
  useListenToEntityProp(owningPlayer?.entity, "gold");

  if (!selection || selection.owner !== getLocalPlayer()?.id) return null;

  // Show menu actions if menu is active
  let displayActions = currentMenu
    ? currentMenu.action.actions
    : selection.actions ?? [];

  // Add item actions from inventory
  if (!currentMenu && selection.inventory) {
    const itemActions: UnitDataAction[] = [];
    for (const item of selection.inventory) {
      if (item.action && (!item.charges || item.charges > 0)) {
        // Create an action with the charge count in the name if applicable
        const actionWithCharges = {
          ...item.action,
          name: item.charges
            ? `${item.action.name} (${item.charges})`
            : item.action.name,
        };
        itemActions.push(actionWithCharges);
      }
    }
    displayActions = [...displayActions, ...itemActions];
  }

  return (
    <div
      className="card h-stack hide-empty"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        gap: 10,
        padding: 12,
      }}
    >
      {displayActions.map((a, i) => (
        <Action
          key={i}
          action={a}
          entity={selection}
          current={a.type === "build"
            ? selection.order?.type === "build" &&
              selection.order.unitType === a.unitType
            : a.type === "auto"
            ? a.order === (selection.order?.type === "cast"
              ? selection.order.orderId
              : selection.order?.type === "hold"
              ? "hold"
              : !selection.order
              ? "stop"
              : undefined)
            : a.type === "target"
            ? a.order === "attack"
              ? selection.order?.type === "attack" ||
                (selection.order?.type === "attackMove")
              : a.order === "move" && !!selection.order &&
                "path" in selection.order
            : a.type === "purchase"
            ? false // Purchase actions are instant, never current
            : a.type === "menu"
            ? !!(currentMenu && currentMenu.action === a)
            : false}
        />
      ))}
    </div>
  );
};
