self.addEventListener("install", () => self.skipWaiting());
self.addEventListener(
  "activate",
  (event) => event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) { /* fall through with empty payload */ }
  const players = data.players ?? 0;
  const lobbies = data.lobbies ?? 0;
  const activeRounds = data.activeRounds ?? 0;
  const reason = data.reason ?? "update";

  const title = reason === "first-player"
    ? "Someone is on Sheep Tag"
    : reason === "first-round"
    ? "A round just started"
    : "Sheep Tag activity";

  const body = activeRounds > 0
    ? `${players} online · ${activeRounds} round${
      activeRounds === 1 ? "" : "s"
    } in progress`
    : `${players} online · ${lobbies} ${lobbies === 1 ? "lobby" : "lobbies"}`;

  event.waitUntil(self.registration.showNotification(title, {
    tag: "sheep-tag-status",
    body,
    renotify: false,
    requireInteraction: true,
    data: { url: "/status" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ||
    "/status";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of all) {
      try {
        const u = new URL(client.url);
        if (u.pathname === url) {
          await client.focus();
          return;
        }
      } catch (_) { /* ignore non-http clients */ }
    }
    await self.clients.openWindow(url);
  })());
});
