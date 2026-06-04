// dinkus — service worker. caches the app for offline use.
// bump CACHE_NAME whenever you want phones to fetch fresh assets.
const CACHE_NAME = 'dinkus-v48';
const PRECACHE = [
  './',
  './reading-tracker.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// Allow the page to ask a waiting SW to activate immediately (used by the "refresh" banner)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Skip non-GET and skip live API endpoints — these must always hit the network,
  // never be cached, otherwise the app reads stale data
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('.supabase.co')) return;
  if (e.request.url.includes('googleapis.com/books')) return;
  if (e.request.url.includes('openlibrary.org')) return;

  // Network-first for the main HTML so updates land quickly. Cache-first for everything else.
  if (e.request.mode === 'navigate' || e.request.url.endsWith('reading-tracker.html')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./reading-tracker.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      // Cache successful same-origin or font/cover responses for offline use
      if (r.ok && (r.type === 'basic' || r.type === 'cors')) {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => cached))
  );
});
