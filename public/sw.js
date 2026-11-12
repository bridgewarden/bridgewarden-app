const VERSION = '__VERSION__';
const BUILD_ASSETS = [];

const CACHE = `bridgewarden-shell-${VERSION}`;
const PRECACHE = [
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  ...BUILD_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        PRECACHE.map((path) =>
          cache.add(
            path === '/offline' ? new Request(new URL(path, self.location.origin), { credentials: 'omit' }) : path,
          ),
        ),
      );
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/setup'))
    return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/offline') {
      event.respondWith(caches.match('/offline').then((cached) => cached ?? fetch(request)));
      return;
    }
    event.respondWith(fetch(request).catch(() => Response.redirect('/offline', 302)));
    return;
  }

  const path = url.pathname;
  if (PRECACHE.includes(path)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
  }
});
