// Service Worker for PWA functionality
const CACHE_NAME = 'yeunrlsd-v1';
const urlsToCache = [
  '/',
  '/static/css/styles.css',
  '/static/js/app.js',
  '/static/manifest.json',
  '/static/img/favicon.ico'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  const request = event.request;

  // Simple runtime caching for images (cache-first, then network)
  if (request.destination === 'image' || /vercel-storage\.com/.test(request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(networkResponse => {
            // Update cache for next time (ignore opaque responses safely)
            try { cache.put(request, networkResponse.clone()); } catch (e) {}
            return networkResponse;
          }).catch(() => cached);

          // Return cached if available immediately, otherwise wait for network
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Default handler: try cache, then network
  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
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