/**
 * Records a Chrome performance trace of a page loading, for load-time work:
 * launches headless Chromium, navigates to the page and keeps tracing for a
 * while, then writes the trace, which DevTools or scripts/analyzeTrace.ts
 * can open.
 *
 *   deno run -A scripts/loadTrace.ts [out.json] [url] [seconds] [expression]
 *
 * An expression, if given, is evaluated in the page after those seconds, still
 * tracing, and its result printed once it settles; it can drive the page, such
 * as starting a game, to trace what follows. With SCREENSHOT=file.png set, the page is then captured.
 *
 * With CDP=http://127.0.0.1:9223 it uses a browser already running with that
 * debugging port instead, in a tab of its own: Chrome on the real GPU, started
 * with --remote-debugging-port=9223 and a --user-data-dir of its own, times
 * the GPU truly where SwiftShader cannot. GPU_DETAIL=1 also traces the GPU
 * process's own work: decoding commands, uploads and the like.
 *
 * Chromium comes from Playwright's cache (`npx playwright install
 * chromium-headless-shell`); set CHROME to use another. It renders with
 * SwiftShader, so shader and draw costs run slower than on a GPU, but load
 * work in JavaScript compares fairly between runs.
 */

const [
  out = "load-trace.json",
  url = "http://127.0.0.1:8000/",
  seconds = "7",
  expression,
] = Deno.args;

const findChrome = () => {
  const env = Deno.env.get("CHROME");
  if (env) return env;
  const cache = `${Deno.env.get("HOME")}/.cache/ms-playwright`;
  for (const dir of Deno.readDirSync(cache)) {
    if (!dir.name.startsWith("chromium_headless_shell")) continue;
    for (const sub of Deno.readDirSync(`${cache}/${dir.name}`)) {
      const path = `${cache}/${dir.name}/${sub.name}/chrome-headless-shell`;
      try {
        Deno.statSync(path);
        return path;
      } catch { /* not this one */ }
    }
  }
  throw new Error("No Chromium found; set CHROME");
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// An already running browser, such as Chrome on the real GPU started with
// --remote-debugging-port and a profile of its own, gets a tab of its own;
// otherwise headless Chromium is launched
const cdp = Deno.env.get("CDP");
const port = 9333;
const chrome = cdp ? undefined : new Deno.Command(findChrome(), {
  args: [
    `--remote-debugging-port=${port}`,
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1280,800",
    "about:blank",
  ],
  stdout: "null",
  stderr: "null",
}).spawn();

type Target = { id: string; type: string; webSocketDebuggerUrl: string };
let opened: Target | undefined;

try {
  let target: Target | undefined;
  if (cdp) {
    opened = await (await fetch(`${cdp}/json/new?about:blank`, {
      method: "PUT",
    })).json();
    target = opened;
  }
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t: Target) => t.type === "page");
    } catch { /* not up yet */ }
  }
  if (!target) throw new Error("Chromium did not start");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.onopen = r);
  let nextId = 0;
  const pending = new Map<number, (result: unknown) => void>();
  const events: unknown[] = [];
  let tracingDone: () => void = () => {};
  const done = new Promise<void>((r) => tracingDone = r);
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id !== undefined) pending.get(data.id)?.(data.result);
    else if (data.method === "Tracing.dataCollected") {
      events.push(...data.params.value);
    } else if (data.method === "Tracing.tracingComplete") tracingDone();
  };
  const send = (method: string, params: object = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Tracing.start", {
    transferMode: "ReportEvents",
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "v8.execute",
        "disabled-by-default-v8.cpu_profiler",
        "blink.user_timing",
        "loading",
        "gpu",
        ...(Deno.env.get("GPU_DETAIL")
          ? [
            "disabled-by-default-gpu.service",
            "gpu.decoder",
            "gpu.angle",
            "viz",
          ]
          : []),
      ],
    },
  });
  await send("Page.navigate", { url });
  await sleep(Number(seconds) * 1000);
  if (expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }) as { result?: { value?: unknown }; exceptionDetails?: unknown };
    console.log(
      JSON.stringify(result.result?.value ?? result.exceptionDetails),
    );
  }
  await send("Tracing.end");
  await done;
  const screenshot = Deno.env.get("SCREENSHOT");
  if (screenshot) {
    const { data } = await send("Page.captureScreenshot", {
      format: "png",
    }) as { data: string };
    await Deno.writeFile(
      screenshot,
      Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
    );
  }
  ws.close();
  await Deno.writeTextFile(out, JSON.stringify({ traceEvents: events }));
  console.log(`Wrote ${events.length} events to ${out}`);
} finally {
  chrome?.kill();
  if (opened) await fetch(`${cdp}/json/close/${opened.id}`).catch(() => {});
}
