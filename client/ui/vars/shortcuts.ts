import { makeVar } from "@/hooks/useVar.tsx";
import {
  createInitialShortcuts,
  defaultBindings,
  type Shortcuts,
} from "@/util/shortcutUtils.ts";
import { menusVar } from "./menus.ts";
import { presetOverrides } from "./presets.ts";
import { shortcutSettingsVar } from "./shortcutSettings.ts";

// Load menu bindings from localStorage
const loadMenuBindingsFromStorage = (
  currentShortcuts: Shortcuts,
  allMenus: ReturnType<typeof menusVar>,
): Shortcuts => {
  const updatedShortcuts = { ...currentShortcuts };

  const localStorageShortcuts = (() => {
    try {
      return JSON.parse(localStorage.getItem("shortcuts") ?? "");
    } catch {
      return {};
    }
  })();

  for (const menu of allMenus) {
    for (const prefab of menu.prefabs) {
      const menuBindingKey = `menu-${menu.id}`;
      const storedBinding = localStorageShortcuts[prefab]?.[menuBindingKey];

      if (storedBinding) {
        if (!updatedShortcuts[prefab]) {
          updatedShortcuts[prefab] = {};
        }
        updatedShortcuts[prefab][menuBindingKey] = storedBinding;
      }
    }
  }

  return updatedShortcuts;
};

// Apply bindingOverrides from menus (e.g. build menu reassigns bite)
const applyMenuBindingOverrides = (
  shortcuts: Shortcuts,
  allMenus: ReturnType<typeof menusVar>,
): Shortcuts => {
  const result = { ...shortcuts };
  for (const menu of allMenus) {
    if (!menu.bindingOverrides) continue;
    for (const prefab of menu.prefabs) {
      const section = result[prefab];
      const defaults = defaultBindings[prefab];
      if (!section || !defaults) continue;
      const updated = { ...section };
      for (
        const [actionKey, override] of Object.entries(menu.bindingOverrides)
      ) {
        const current = updated[actionKey];
        const def = defaults[actionKey];
        // Only apply if binding hasn't been manually customized
        if (current && def && current.join("+") === def.join("+")) {
          updated[actionKey] = override;
        }
      }
      result[prefab] = updated;
    }
  }
  return result;
};

// Apply preset binding overrides (e.g. WC3 remaps move to M)
const applyPresetOverrides = (shortcuts: Shortcuts): Shortcuts => {
  const { preset } = shortcutSettingsVar();
  const overrides = presetOverrides[preset].bindings;
  const result = { ...shortcuts };
  for (const [section, bindings] of Object.entries(overrides)) {
    if (!result[section]) continue;
    const updated = { ...result[section] };
    for (const [key, binding] of Object.entries(bindings)) {
      // Only apply if binding hasn't been manually customized from its EST default
      const estDefault = defaultBindings[section]?.[key];
      if (estDefault && updated[key]?.join("+") === estDefault.join("+")) {
        updated[key] = binding;
      }
    }
    result[section] = updated;
  }
  return result;
};

// Build complete shortcuts: defaults + localStorage + preset + menu overrides
const buildShortcuts = (allMenus: ReturnType<typeof menusVar>): Shortcuts => {
  const base = createInitialShortcuts();
  const withMenuBindings = loadMenuBindingsFromStorage(base, allMenus);
  const withPreset = applyPresetOverrides(withMenuBindings);
  return applyMenuBindingOverrides(withPreset, allMenus);
};

export const shortcutsVar = makeVar<Shortcuts>(buildShortcuts(menusVar()));

// When menus change, rebuild shortcuts from scratch.
// Override values aren't persisted to localStorage (isDefaultBinding treats
// them as defaults), so rebuilding naturally reverts overrides from deleted
// menus and applies overrides from new menus.
let previousMenus = menusVar();
menusVar.subscribe(() => {
  const current = shortcutsVar();
  const allMenus = menusVar();
  const rebuilt = buildShortcuts(allMenus);

  // Preserve user customizations from current state that may not be in
  // localStorage yet (e.g. binding changed in same session before flush).
  // Skip values that are override artifacts (not genuine user choices).
  const allOverrideValues = new Map<string, Set<string>>();
  for (const menu of [...allMenus, ...previousMenus]) {
    if (!menu.bindingOverrides) continue;
    for (const prefab of menu.prefabs) {
      for (
        const [actionKey, override] of Object.entries(menu.bindingOverrides!)
      ) {
        const mapKey = `${prefab}.${actionKey}`;
        if (!allOverrideValues.has(mapKey)) {
          allOverrideValues.set(mapKey, new Set());
        }
        allOverrideValues.get(mapKey)!.add(override.join("+"));
      }
    }
  }
  // Also track preset override values (from all presets, not just current)
  for (const preset of Object.values(presetOverrides)) {
    for (const [section, bindings] of Object.entries(preset.bindings)) {
      for (const [key, binding] of Object.entries(bindings)) {
        const mapKey = `${section}.${key}`;
        if (!allOverrideValues.has(mapKey)) {
          allOverrideValues.set(mapKey, new Set());
        }
        allOverrideValues.get(mapKey)!.add(binding.join("+"));
      }
    }
  }
  for (const [section, shortcuts] of Object.entries(current)) {
    if (section === "misc") continue;
    const defaults = defaultBindings[section];
    if (!defaults) continue;
    for (const [key, binding] of Object.entries(shortcuts)) {
      if (key.startsWith("menu-")) continue;
      const def = defaults[key];
      if (!def || binding.join("+") === def.join("+")) continue;
      // Skip if this value came from a menu or preset override (not a user choice)
      const overrides = allOverrideValues.get(`${section}.${key}`);
      if (overrides?.has(binding.join("+"))) continue;
      if (rebuilt[section]?.[key]?.join("+") !== binding.join("+")) {
        rebuilt[section] = { ...rebuilt[section], [key]: binding };
      }
    }
  }

  // Clean up menu keys for deleted menus
  const validMenuIds = new Set(allMenus.map((m) => m.id));
  for (const [section, shortcuts] of Object.entries(rebuilt)) {
    for (const key of Object.keys(shortcuts)) {
      if (key.startsWith("menu-") && !key.includes(".")) {
        if (!validMenuIds.has(key.substring(5))) {
          delete rebuilt[section][key];
        }
      }
    }
  }

  previousMenus = allMenus;

  if (JSON.stringify(rebuilt) !== JSON.stringify(current)) {
    shortcutsVar(rebuilt);
  }
});
