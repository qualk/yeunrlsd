// bunx workbox-cli injectManifest workbox-config.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// Precache all assets
workbox.precaching.precacheAndRoute([{"revision":"99a592fc48cab45f8d1c658d70732c94","url":"static/css/styles.css"},{"revision":"b82feb148be6852758c412bf4efd3628","url":"static/icons/icon-128x128.avif"},{"revision":"c4829ab16a236cd5bb902c03cd1dfcc2","url":"static/icons/icon-192x192.avif"},{"revision":"b347bb64d262175494e78fecdaf2d6c8","url":"static/icons/icon-384x384.avif"},{"revision":"6e69f6b9e7da25a32d840b3eca9f9771","url":"static/icons/icon-512x512.avif"},{"revision":"80ba9e6bcf6dd23a551277b1ce615d2b","url":"static/img/404.ico"},{"revision":"88c7d704d5556f4c261a0f7a200b2fe6","url":"static/img/favicon.ico"},{"revision":"18700a43e354450582cf8e24714d93d5","url":"static/img/logo.avif"},{"revision":"50a8db8c43e3baf42026594a65cf1713","url":"static/js/app.js"},{"revision":"31217ae3647183f78ba7e2ea24693ad9","url":"static/js/datastar-client.js"},{"revision":"bb70b47eeab94d14013e478feb92b535","url":"static/manifest.json"}]);

// Cache images with CacheFirst
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache audio with CacheFirst and RangeRequestsPlugin
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'audio',
  new workbox.strategies.CacheFirst({
    cacheName: 'audio',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [200],
      }),
      new workbox.rangeRequests.RangeRequestsPlugin(),
    ],
  })
);

// Cache CSS and JS with StaleWhileRevalidate
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Cache fonts
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'font',
  new workbox.strategies.CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new workbox.expiration.ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// Cache pages with StaleWhileRevalidate for offline support
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'pages',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Cache album fragments (Datastar AJAX)
workbox.routing.registerRoute(
  ({ request }) => new URL(request.url).pathname.startsWith('/p/'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'fragments',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);