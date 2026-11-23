import { readdir, readFile, writeFile } from "node:fs/promises";
import type { MapManifestEntry } from "@/shared/maps/manifest.ts";

const MAPS_DIR = "shared/maps";
const OUTPUT = `${MAPS_DIR}/manifest.json`;

export const buildMapManifest = async () => {
  const entries: MapManifestEntry[] = [];
  for (const entry of await readdir(MAPS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    if (entry.name === "manifest.json") continue;
    const id = entry.name.replace(/\.json$/, "");
    const raw = await readFile(`${MAPS_DIR}/${entry.name}`, "utf8");
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
  const current = await readFile(OUTPUT, "utf8").catch(() => null);
  if (current !== next) await writeFile(OUTPUT, next);
  return entries;
};

if (import.meta.main) {
  const entries = await buildMapManifest();
  console.log(`[BuildMapManifest] Wrote ${entries.length} maps to ${OUTPUT}`);
}
