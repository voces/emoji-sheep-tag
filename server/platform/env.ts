/**
 * Process environment and arguments. Game modules are also bundled into the
 * browser's local server, where there is no process: there `env` reads every
 * variable as unset and `args` is empty.
 */
const proc = globalThis.process;

export const env = (key: string): string | undefined => proc?.env[key];

/** Arguments after the script, as `deno run script.ts ...args` passes them. */
export const args: readonly string[] = proc?.argv.slice(2) ?? [];

/**
 * Node's fs, on runtimes that have it. Synchronous, so modules shared with the
 * browser can read files without importing `node:fs`, which the browser bundle
 * cannot resolve.
 */
export const nodeFs = () => proc?.getBuiltinModule("node:fs");
