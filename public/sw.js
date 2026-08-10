// Bump this when the precache list or SW logic changes so old caches (which
// referenced now-removed routes like /goals, /people) are dropped on activate.
const CACHE_NAME = "slo-v2";
const PRECACHE_URLS = ["/dashboard", "/calendar", "/tasks", "/reflections"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each URL independently: cache.addAll() rejects the whole install
      // if ANY single request fails (404, auth redirect), which previously left
      // the SW uninstalled. Per-URL allSettled tolerates individual misses.
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { redirect: "follow" }).then((res) => {
            if (res.ok) return cache.put(url, res);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Only fetch same-origin requests to prevent SSRF
  try {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
      return;
    }
  } catch {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Leadership OS", body: "You have a notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(self.clients.openWindow(url));
});
