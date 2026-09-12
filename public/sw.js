const CACHE = "one-pro-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/brand/one-pro-logo.svg", "/brand/one-pro-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((hit) => hit || caches.match("/"))));
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { title: "One Pro", body: "Ada tugas yang perlu diselesaikan." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/brand/one-pro-logo.png",
    badge: "/brand/one-pro-logo.png",
    data: payload.data ?? { url: "/" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/"));
});
