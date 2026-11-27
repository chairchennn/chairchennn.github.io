// FilmDoodle service worker：把程式本身存起來，離線也能用。
// 照片不會經過這裡（照片從來不會被送到網路上）。
const VERSION = 'filmdoodle-v7';
const SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/app.js', './js/film.js', './js/frames.js', './js/stickers.js', './js/exif.js', './js/doodles.js', './js/fourcut.js',
  './js/art/shapes.js', './js/art/fr_jp.js', './js/art/y2k_emoji.js', './js/art/crayon.js', './js/crayon.js',
  './js/tape.js', './js/art/stationery.js',
  './icons/tools/add.svg', './icons/tools/stamp.svg', './icons/tools/scissors.svg', './icons/tools/tape.svg',
  './icons/tools/glue.svg', './icons/tools/notebook.svg',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  // 自己的檔案：先拿網路上最新的，失敗再用快取（更新後馬上生效，離線也能開）
  if (sameOrigin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  // 字型：快取優先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});
