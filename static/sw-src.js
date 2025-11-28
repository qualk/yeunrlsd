// bunx workbox-cli injectManifest workbox-config.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

// Precache all assets
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);

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