const CACHE = 'jt-train-v9';
const STATIC = [
  '/jt-train/jt_train.html',
  '/jt-train/manifest.json',
  '/jt-train/js/api.js',
  '/jt-train/js/equipment.js',
  '/jt-train/js/set_logger.js',
  '/jt-train/js/app.js',
  '/jt-train/js/screens/history.js',
  '/jt-train/js/screens/injuries.js',
  '/jt-train/js/screens/coach.js',
  '/jt-train/js/screens/session.js',
  '/jt-train/js/screens/progress.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache API calls to the worker
  if (e.request.url.includes('workers.dev') || e.request.url.includes('anthropic.com')) return;
  // Network first for HTML, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
