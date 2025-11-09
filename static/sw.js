// Service Worker for PWA functionality
const CACHE_NAME = 'yeunrlsd-v2';
const urlsToCache = [
  '/',
  '/static/css/styles.css',
  '/static/js/app.js',
  '/static/js/datastar-client.js',
  '/static/manifest.json',
  '/static/img/favicon.ico',
  '/static/icons/icon-128x128.avif',
  '/static/icons/icon-192x192.avif',
  '/static/icons/icon-384x384.avif',
  '/static/icons/icon-512x512.avif',
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Cache-first for images (including CDN)
  if (request.destination === 'image' || /vercel-storage\.com/.test(request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(networkResponse => {
            try { cache.put(request, networkResponse.clone()); } catch (e) {}
            return networkResponse;
          }).catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // App shell-style navigation: serve index.html for navigation requests (SPA offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then(response => {
        return response || fetch(request).catch(() => new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } }));
      })
    );
    return;
  }

  // Cache-first for static assets, network fallback
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).catch(() => {
        // Fallback for offline errors (optional: customize per asset type)
        if (request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});