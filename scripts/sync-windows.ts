const src = Deno.args[0] || "/home/verit/emoji-sheep-tag";
const dest = Deno.args[1] || "/mnt/d/emoji-sheep-tag";

const ignore = [".git", "node_modules", "dist", "target", ".env"];

const shouldIgnore = (path: string) => {
  const rel = path.slice(src.length + 1);
  return ignore.some((i) => rel.startsWith(i) || rel.includes(`/${i}/`));
};

const copy = async (path: string) => {
  if (shouldIgnore(path)) return;
  const rel = path.slice(src.length);
  const target = dest + rel;
  try {
    const srcStat = await Deno.stat(path);
    if (srcStat.isDirectory) {
      await Deno.mkdir(target, { recursive: true });
      return;
    }
    try {
      const destStat = await Deno.stat(target);
      if (
        destStat.mtime && srcStat.mtime &&
        destStat.mtime >= srcStat.mtime && destStat.size === srcStat.size
      ) return;
    } catch { /* dest doesn't exist */ }
    await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), {
      recursive: true,
    });
    await Deno.copyFile(path, target);
    console.log(`synced: ${rel}`);
  } catch {
    try {
      await Deno.remove(target, { recursive: true });
      console.log(`removed: ${rel}`);
    } catch { /* already gone */ }
  }
};

const syncAll = async (dir: string) => {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (shouldIgnore(path)) continue;
    if (entry.isDirectory) await syncAll(path);
    else await copy(path);
  }
};

console.log(`Initial sync ${src} → ${dest}`);
await syncAll(src);
console.log("Initial sync complete. Watching for changes...");

const watcher = Deno.watchFs(src);
for await (const event of watcher) {
  for (const path of event.paths) {
    await copy(path);
  }
}
