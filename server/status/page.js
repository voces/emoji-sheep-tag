const $ = (id) => document.getElementById(id);
const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
const fmtNum = (n) => Number(n ?? 0).toLocaleString();
const fmtAge = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
};
const fmtDur = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + "m " + (r < 10 ? "0" : "") + r + "s";
};

const render = (snap) => {
  $("players").textContent = fmtNum(snap.players);
  $("lobbies").textContent = fmtNum(snap.lobbies);
  $("rounds").textContent = fmtNum(snap.activeRounds);
  $("loadsTotal").textContent = fmtNum(snap.pageLoads?.total);
  const w = snap.pageLoads?.windows ?? {};
  $("w5m").textContent = fmtNum(w["5m"]);
  $("w1h").textContent = fmtNum(w["1h"]);
  $("w1d").textContent = fmtNum(w["1d"]);
  $("w7d").textContent = fmtNum(w["7d"]);
  $("w30d").textContent = fmtNum(w["30d"]);

  const clientsBody = $("clientsBody");
  if (!snap.clients?.length) {
    clientsBody.innerHTML =
      '<tr><td colspan="2" class="muted">Nobody online.</td></tr>';
  } else {
    clientsBody.innerHTML = snap.clients.map((c) =>
      "<tr><td>" + escape(c.name) + "</td><td>" +
      (c.lobby ? escape(c.lobby) : '<span class="muted">—</span>') +
      "</td></tr>"
    ).join("");
  }

  const lobbiesBody = $("lobbiesBody");
  if (!snap.lobbyList?.length) {
    lobbiesBody.innerHTML =
      '<tr><td colspan="4" class="muted">No lobbies.</td></tr>';
  } else {
    lobbiesBody.innerHTML = snap.lobbyList.map((l) =>
      "<tr><td>" + escape(l.name) + "</td><td>" +
      (l.status === "playing" ? "in progress" : "waiting") +
      "</td><td>" + fmtNum(l.players) +
      "</td><td>" +
      (l.shard ? escape(l.shard) : '<span class="muted">primary</span>') +
      "</td></tr>"
    ).join("");
  }

  const shardsBody = $("shardsBody");
  if (!snap.shards?.length) {
    shardsBody.innerHTML =
      '<tr><td colspan="5" class="muted">No shards.</td></tr>';
  } else {
    shardsBody.innerHTML = snap.shards.map((s) => {
      const status = s.status ?? (s.isOnline ? "online" : "offline");
      return "<tr><td>" + escape(s.name) + "</td><td>" +
        (s.region ? escape(s.region) : '<span class="muted">—</span>') +
        "</td><td>" + escape(status) +
        "</td><td>" + fmtNum(s.playerCount) +
        "</td><td>" + fmtNum(s.lobbyCount) + "</td></tr>";
    }).join("");
  }

  const body = $("recentBody");
  if (!snap.recentRounds?.length) {
    body.innerHTML = '<li class="muted">No rounds recorded yet.</li>';
    return;
  }
  const now = Date.now();
  const fmtTeam = (names) =>
    !names?.length
      ? '<span class="muted">none</span>'
      : names.map(escape).join(", ");
  body.innerHTML = snap.recentRounds.map((r) =>
    '<li class="round">' +
    '<div><span class="round__mode">' + escape(r.mode) + "</span>" +
    '<span class="round__lobby">' + escape(r.lobby) + "</span></div>" +
    '<div class="round__duration">' + escape(fmtDur(r.durationMs)) +
    "</div>" +
    '<div class="round__meta">' +
    "<span>" + escape(fmtAge(now - r.endedAt)) + "</span>" +
    "<span>Sheep: " + fmtTeam(r.sheep) + "</span>" +
    "<span>Wolves: " + fmtTeam(r.wolves) + "</span>" +
    "</div></li>"
  ).join("");
};

const source = new EventSource("/api/status");
source.onmessage = (e) => {
  try {
    render(JSON.parse(e.data));
  } catch (err) {
    console.error(err);
  }
};

const urlBase64ToUint8Array = (s) => {
  const pad = "=".repeat((4 - s.length % 4) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const setPushStatus = (text) => {
  $("pushStatus").textContent = text;
};

const updateButton = async () => {
  const btn = $("subscribe");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    btn.disabled = true;
    setPushStatus("Push notifications are not supported in this browser.");
    return;
  }
  if (Notification.permission === "denied") {
    btn.disabled = true;
    setPushStatus(
      "Notifications are blocked. Enable them in your browser settings.",
    );
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) {
    btn.textContent = "Disable push notifications";
    btn.classList.add("unsub");
    setPushStatus(
      "You'll get notified when activity happens. The notification updates in place.",
    );
  } else {
    btn.textContent = "Enable push notifications";
    btn.classList.remove("unsub");
    setPushStatus("");
  }
};

const subscribe = async () => {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    setPushStatus("Permission denied.");
    return;
  }
  const { publicKey } = await fetch("/api/status/vapid-public-key")
    .then((r) => r.json());
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await fetch("/api/status/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  await updateButton();
};

const unsubscribe = async () => {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) {
    await fetch("/api/status/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
  }
  await updateButton();
};

$("subscribe").addEventListener("click", async () => {
  const btn = $("subscribe");
  btn.disabled = true;
  try {
    if (btn.classList.contains("unsub")) await unsubscribe();
    else await subscribe();
  } catch (err) {
    console.error(err);
    setPushStatus("Error: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

updateButton();
