// bunx workbox-cli injectManifest workbox-config.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

// Precache all assets
workbox.precaching.precacheAndRoute([{"revision":"bb70b47eeab94d14013e478feb92b535","url":"static/manifest.json"},{"revision":"37d8e650134929fac085a05a55b53435","url":"static/js/client.js"},{"revision":"002b55e00b4327da7ceaa1931023f2ca","url":"static/js/desktop-player.js"},{"revision":"c7be8b5a366588d23124cb4ed9fb043c","url":"static/js/app.js"},{"revision":"88c7d704d5556f4c261a0f7a200b2fe6","url":"static/icons/favicon.ico"},{"revision":"80ba9e6bcf6dd23a551277b1ce615d2b","url":"static/icons/404.ico"},{"revision":"5e3cd4e2a82fa19f07c291d2945a6c91","url":"static/css/styles.css"},{"revision":"bb9451db10d2de6fbc02cb321e767a97","url":"static/css/desktop-player.css"},{"revision":"909592136827d616d095d91a521f06d2","url":"static/icons/icon-512x512.avif"},{"revision":"4f8a0e4ad65798bc38e44cbce473931f","url":"static/icons/icon-384x384.avif"},{"revision":"4255e56fef7b16fc7a1ff6b87e6212ec","url":"static/icons/icon-192x192.avif"},{"revision":"cdd73b250b50d22e7ce9f973cef3cebc","url":"static/icons/icon-128x128.avif"}]);

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

// Background download songs on non-metered connections
// self.addEventListener('message', (event) => {
//   if (event.data && event.data.type === 'DOWNLOAD_SONGS') {
//     downloadAllSongs();
//   }
// });

// async function downloadAllSongs() {
//   try {
//     // Check if connection is metered
//     const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

//     // Skip if on metered connection or save-data is enabled
//     if (connection && (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
//       console.log('Skipping song download: metered connection detected');
//       return;
//     }

//     console.log('Starting background song download...');

//     // Fetch song list from API
//     const response = await fetch('/api/songs');
//     if (!response.ok) {
//       throw new Error('Failed to fetch song list');
//     }

//     const songs = await response.json();
//     console.log(`Found ${songs.length} songs to download`);

//     // Download each song in background
//     const cache = await caches.open('audio');
//     const downloadPromises = songs.map(async (songUrl) => {
//       try {
//         const response = await fetch(songUrl);
//         if (response.ok) {
//           await cache.put(songUrl, response);
//           console.log(`Downloaded: ${songUrl}`);
//         }
//       } catch (error) {
//         console.warn(`Failed to download ${songUrl}:`, error);
//       }
//     });

//     await Promise.allSettled(downloadPromises);
//     console.log('Song download complete');

//   } catch (error) {
//     console.error('Error in song download:', error);
//   }
// }

// Trigger song download when service worker is ready
// self.addEventListener('activate', (event) => {
//   event.waitUntil(
//     // Small delay to let the page load first
//     new Promise(resolve => setTimeout(resolve, 5000)).then(() => {
//       downloadAllSongs();
//     })
//   );
// });