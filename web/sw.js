// VPVie PWA service worker. Mọi đường dẫn đều tương đối với scope để hoạt động
// ở tên miền riêng, thư mục con và GitHub Pages.
const CACHE_VERSION = "vpvie-ios-v9";
const CORE = [
  "./", "./index.html", "./bang.html", "./soanthao.html", "./markdown.html",
  "./htmledit.html", "./bangtinh.html", "./trinhchieu.html", "./pdf.html",
  "./style.css", "./office.css", "./oxyz.css", "./manifest.webmanifest",
  "./js/pwa.js", "./js/app.js", "./js/beautify.js", "./js/mathplot.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE.map((path) => new URL(path, self.registration.scope))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const relativePath = url.pathname.slice(scope.pathname.length);
  if (relativePath.startsWith("api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(new URL("./bang.html", scope))))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      });
      return cached || refresh;
    })
  );
});
