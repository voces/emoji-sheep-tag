import type { MapManifestEntry } from "@/shared/maps/manifest.ts";

const MAPS_DIR = "shared/maps";
const OUTPUT = `${MAPS_DIR}/manifest.json`;

export const buildMapManifest = async () => {
  const entries: MapManifestEntry[] = [];
  for await (const entry of Deno.readDir(MAPS_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    if (entry.name === "manifest.json") continue;
    const id = entry.name.replace(/\.json$/, "");
    const raw = await Deno.readTextFile(`${MAPS_DIR}/${entry.name}`);
    const data = JSON.parse(raw) as { name?: string; tags?: string[] };
    const manifestEntry: MapManifestEntry = {
      id,
      name: data.name ?? id,
      ...(data.tags?.length ? { tags: data.tags } : {}),
    };
    entries.push(manifestEntry);
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const next = JSON.stringify(entries, null, 2) + "\n";
  const current = await Deno.readTextFile(OUTPUT).catch(() => null);
  if (current !== next) await Deno.writeTextFile(OUTPUT, next);
  return entries;
};

if (import.meta.main) {
  const entries = await buildMapManifest();
  console.log(`[BuildMapManifest] Wrote ${entries.length} maps to ${OUTPUT}`);
}
