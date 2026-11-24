import { afterAll, expect, it } from "vitest";
import { serve } from "./serve.ts";

const server = serve({ port: 0 }, (req, connection) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response(`hello ${new URL(req.url).pathname}`);
  }
  const { socket, response } = connection.upgradeWebSocket();
  if (new URL(req.url).pathname === "/healthcheck") {
    socket.addEventListener("open", () => socket.close(1000, "ok"));
    return response;
  }
  socket.addEventListener("message", (e) => {
    if (e.data === "bye") socket.close(4001, "bye");
    else socket.send(`echo ${e.data}`);
  });
  return response;
});

afterAll(() => server.shutdown());

it("answers HTTP requests", async () => {
  const response = await fetch(`http://localhost:${server.port}/path`);
  expect(await response.text()).toBe("hello /path");
});

const nextClose = (ws: WebSocket) =>
  new Promise<CloseEvent>((resolve) => ws.addEventListener("close", resolve));

it("opens the socket after the handler has attached its listeners", async () => {
  const { code, reason } = await nextClose(
    new WebSocket(`ws://localhost:${server.port}/healthcheck`),
  );
  expect([code, reason]).toEqual([1000, "ok"]);
});

it("upgrades to a WebSocket that echoes and closes with a code", async () => {
  const ws = new WebSocket(`ws://localhost:${server.port}/`);
  const messages: string[] = [];
  const closed = new Promise<CloseEvent>((resolve) =>
    ws.addEventListener("close", resolve)
  );
  ws.addEventListener("message", (e) => {
    messages.push(e.data);
    ws.send("bye");
  });
  ws.addEventListener("open", () => ws.send("hi"));

  const { code, reason } = await closed;
  expect(messages).toEqual(["echo hi"]);
  expect([code, reason]).toEqual([4001, "bye"]);
});
