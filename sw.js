// bunx workbox-cli injectManifest workbox-config.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// Precache all assets
workbox.precaching.precacheAndRoute([{"revision":"0c1932ede18cd1a7e87640aa1420cf6d","url":"static/anim/JiK.avif"},{"revision":"94b1e5453ad9338726af6c714ea38370","url":"static/anim/tgfd.avif"},{"revision":"f5fda7f969fe2641b1ba5443cebe6faa","url":"static/anim/war.avif"},{"revision":"4294e61d15f203eb45b45cf484c8a7e1","url":"static/anim/yandhi.avif"},{"revision":"0ef641cc2f77a1d39c81aca6a2db88bc","url":"static/css/styles.css"},{"revision":"cdd73b250b50d22e7ce9f973cef3cebc","url":"static/icons/icon-128x128.avif"},{"revision":"4255e56fef7b16fc7a1ff6b87e6212ec","url":"static/icons/icon-192x192.avif"},{"revision":"4f8a0e4ad65798bc38e44cbce473931f","url":"static/icons/icon-384x384.avif"},{"revision":"909592136827d616d095d91a521f06d2","url":"static/icons/icon-512x512.avif"},{"revision":"80ba9e6bcf6dd23a551277b1ce615d2b","url":"static/img/404.ico"},{"revision":"ba2f047225df82272e7178d1a011b5fe","url":"static/img/bully.avif"},{"revision":"89b33b4350ea04286772839f77653b69","url":"static/img/donda_float.avif"},{"revision":"18930d4a78e8861a0acfb119d39204c7","url":"static/img/donda.avif"},{"revision":"88c7d704d5556f4c261a0f7a200b2fe6","url":"static/img/favicon.ico"},{"revision":"fa91fecd2cb660f3c1642ada5ca02ba9","url":"static/img/gaj_bear.avif"},{"revision":"356436807cbf9b5ed4cd595d3f81d90d","url":"static/img/gaj.avif"},{"revision":"5acb7c5a5bdb8d7dbec2ebb0d134ce7f","url":"static/img/JiK.avif"},{"revision":"18700a43e354450582cf8e24714d93d5","url":"static/img/logo.avif"},{"revision":"86d471bed4873947aef46c2daef3b4cd","url":"static/img/tgfd.avif"},{"revision":"7054a3680ee8af8fa00c8a672d581345","url":"static/img/war.avif"},{"revision":"2e435524d1c72733d22ce2b511ec0759","url":"static/img/yandhi.avif"},{"revision":"59ea558a7de4d885b7e66032b75a89ff","url":"static/img/yebu.avif"},{"revision":"9b3197bc9cf7930059c031ed9bd918d0","url":"static/js/app.js"},{"revision":"b484d97e69e033ece15da93d997ae313","url":"static/js/client.js"},{"revision":"bb70b47eeab94d14013e478feb92b535","url":"static/manifest.json"}]);

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

// Cache album fragments
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