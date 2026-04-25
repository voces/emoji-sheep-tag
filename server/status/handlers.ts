import { z } from "zod";
import { createStatusStream } from "./sse.ts";
import { getVapidPublicKey } from "./push.ts";
import { addSubscription, removeSubscription } from "./storage.ts";
import statusPageHtml from "./page.html" with { type: "text" };
import statusPageJs from "./page.js" with { type: "text" };
import serviceWorkerJs from "./serviceWorker.js" with { type: "text" };

const NO_STORE = {
  headers: { "cache-control": "no-store" },
} satisfies ResponseInit;

const zSubscription = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

const zUnsubscribe = z.object({ endpoint: z.string() });

const parseBody = async <T>(req: Request, schema: z.ZodType<T>) => {
  try {
    return schema.safeParse(await req.json());
  } catch {
    return { success: false } as const;
  }
};

const handleSubscribe = async (req: Request) => {
  if (req.method === "POST") {
    const result = await parseBody(req, zSubscription);
    if (!result.success) {
      return Response.json({ error: "invalid subscription" }, { status: 400 });
    }
    await addSubscription({ ...result.data, createdAt: Date.now() });
    return Response.json({ ok: true }, NO_STORE);
  }
  if (req.method === "DELETE") {
    const result = await parseBody(req, zUnsubscribe);
    if (!result.success) {
      return Response.json({ error: "missing endpoint" }, { status: 400 });
    }
    await removeSubscription(result.data.endpoint);
    return Response.json({ ok: true }, NO_STORE);
  }
  return Response.json({ error: "method not allowed" }, { status: 405 });
};

export const handleStatusRoute = async (
  req: Request,
  url: URL,
): Promise<Response | undefined> => {
  const path = url.pathname;

  if (path === "/api/status") return await createStatusStream();
  if (path === "/api/status/subscribe") return await handleSubscribe(req);
  if (path === "/api/status/vapid-public-key") {
    return Response.json(
      { publicKey: await getVapidPublicKey() },
      NO_STORE,
    );
  }
  if (path === "/sw.js") {
    return new Response(serviceWorkerJs, {
      headers: {
        "content-type": "application/javascript",
        "cache-control": "no-cache",
        "service-worker-allowed": "/",
      },
    });
  }
  if (path === "/status/page.js") {
    return new Response(statusPageJs, {
      headers: {
        "content-type": "application/javascript",
        "cache-control": "no-cache",
      },
    });
  }
  if (path === "/status") {
    return new Response(statusPageHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  }
  return undefined;
};

export const isPageLoad = (path: string) =>
  path === "/" || path === "/index.html";
