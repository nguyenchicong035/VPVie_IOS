// VPVie PWA service worker. Mọi đường dẫn đều tương đối với scope để hoạt động
// ở tên miền riêng, thư mục con và GitHub Pages.
const CACHE_VERSION = "vpvie-ios-v12";
const CORE = [
  "./pwa.css?v=1.1.7", "./js/tools-table.js?v=1.1.7",
  "./",
  "./index.html",
  "./bang.html",
  "./soanthao.html",
  "./markdown.html",
  "./htmledit.html",
  "./bangtinh.html",
  "./trinhchieu.html",
  "./pdf.html",
  "./style.css",
  "./office.css",
  "./oxyz.css",
  "./manifest.webmanifest",
  "./js/license.js",
  "./js/ink-recognize.js",
  "./js/tools-solid.js",
  "./js/pwa.js",
  "./js/app.js",
  "./js/beautify.js",
  "./js/mathplot.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./vendor/pdfjs/pdf.min.js",
  "./vendor/mammoth.browser.min.js",
  "./vendor/katex/katex.min.js",
  "./vendor/function-plot.js",
  "./vendor/math.min.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/html2canvas.min.js",
  "./js/recognize.js",
  "./js/tools-grapher.js",
  "./js/tools-calc.js",
  "./js/tools-sci.js",
  "./js/tools-geo.js",
  "./js/tools-quiz.js",
  "./js/tools-class.js",
  "./js/tools-mindmap.js",
  "./js/tools-chart.js",
  "./js/tools-flash.js",
  "./js/tools-multab.js",
  "./js/tools-video.js",
  "./js/tools-alpha.js",
  "./js/tools-science.js",
  "./js/tools-diagram.js",
  "./js/tools-formula.js",
  "./js/tools-solid.js?v=1.1.7",
  "./js/oxyz-math.js",
  "./js/tools-oxyz.js",
  "./js/tools-var.js",
  "./js/tools-ruler.js",
  "./js/tools-export.js",
  "./js/gdrive.js",
  "./js/ink-recognize.js?v=1.1.7",
  "./js/app.js?v=1.1.7",
  "./js/pwa.js?v=1.1.7",
  "./vendor/katex/katex.min.css",
  "./style.css?v=1.1.7",
  "./icons/icon-32.png",
  "./vendor/pdfjs/pdf.worker.min.js",
  "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_AMS-Regular.woff",
  "./vendor/katex/fonts/KaTeX_AMS-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff",
  "./vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf",
  "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Main-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Bold.woff",
  "./vendor/katex/fonts/KaTeX_Main-Bold.ttf",
  "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff",
  "./vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf",
  "./vendor/katex/fonts/KaTeX_Main-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Italic.woff",
  "./vendor/katex/fonts/KaTeX_Main-Italic.ttf",
  "./vendor/katex/fonts/KaTeX_Main-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Main-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff",
  "./vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf",
  "./vendor/katex/fonts/KaTeX_Math-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_Math-Italic.woff",
  "./vendor/katex/fonts/KaTeX_Math-Italic.ttf",
  "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff",
  "./vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf",
  "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff",
  "./vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf",
  "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff",
  "./vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Script-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Script-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Script-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size1-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Size1-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size2-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Size2-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size3-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Size3-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size4-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Size4-Regular.ttf",
  "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff",
  "./vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf"
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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("vpvie-ios-") && key !== CACHE_VERSION).map((key) => caches.delete(key))))
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
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(new URL("./bang.html", scope))))
    );
    return;
  }

  // App code comes from the network first; a previous cached script must not
  // hide a deployment. Cached resources remain available when offline.
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "VERSION" && event.ports[0]) event.ports[0].postMessage(CACHE_VERSION);
});
