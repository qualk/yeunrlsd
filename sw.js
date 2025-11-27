// bunx workbox-cli injectManifest workbox-config.js
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

// Precache all assets
workbox.precaching.precacheAndRoute([{"revision":"bb70b47eeab94d14013e478feb92b535","url":"static/manifest.json"},{"revision":"e721a1dfcd49cdecc6f8681f3c609f94","url":"static/js/player.js"},{"revision":"002b55e00b4327da7ceaa1931023f2ca","url":"static/js/desktop-player.js"},{"revision":"37d8e650134929fac085a05a55b53435","url":"static/js/client.js"},{"revision":"c7be8b5a366588d23124cb4ed9fb043c","url":"static/js/app.js"},{"revision":"8d5ade0b91345cf55fd8cec094395f47","url":"static/img/Gc.avif"},{"revision":"5447ad23458524130d3e8af190145a3d","url":"static/img/ksg2.avif"},{"revision":"aad3cd25be920b24fc7f7eefa3381fe5","url":"static/img/le.avif"},{"revision":"9533970883f6cd3de71ff31f3a8c6442","url":"static/img/wolves.avif"},{"revision":"dc67c2ca895916a2697497cc034c2ba8","url":"static/img/shmG.avif"},{"revision":"cae4e43a311225e42fa9cb9c1deaa54a","url":"static/img/shmC.avif"},{"revision":"a365d311b5fd9bcca7424c2fe1ca993d","url":"static/img/waves.avif"},{"revision":"8ab3d1ac5298c502097b135509ca2720","url":"static/img/swish.avif"},{"revision":"72035176b80f4f4849ef44e69e6ed5dc","url":"static/img/yeezus2.avif"},{"revision":"03fc8a0efd898111c5379020a0764a96","url":"static/img/cw.avif"},{"revision":"bbe6d13c858e44b8fd3e5367674496fc","url":"static/img/vultures3.avif"},{"revision":"d7d5d20829b31db61a638d167fbdba05","url":"static/img/vultures2.avif"},{"revision":"59c5871a5cf3f420f76a2703566d2b99","url":"static/img/vultures1.avif"},{"revision":"28b85d79cf9ad443bb76721d99116ae7","url":"static/img/donda2.avif"},{"revision":"feb1a6b48310871632d196d67f1275c4","url":"static/img/iapw.avif"},{"revision":"f5d3bb8b141d77f3e52f71b2c5c83ccd","url":"static/img/bully.avif"},{"revision":"59ea558a7de4d885b7e66032b75a89ff","url":"static/img/yebu.avif"},{"revision":"2e435524d1c72733d22ce2b511ec0759","url":"static/img/yandhi.avif"},{"revision":"7054a3680ee8af8fa00c8a672d581345","url":"static/img/war.avif"},{"revision":"a4b7e68beb4e6f273e47d6875b09b4e6","url":"static/img/tgx.avif"},{"revision":"86d471bed4873947aef46c2daef3b4cd","url":"static/img/tgfd.avif"},{"revision":"18700a43e354450582cf8e24714d93d5","url":"static/img/logo.avif"},{"revision":"fa91fecd2cb660f3c1642ada5ca02ba9","url":"static/img/gaj_bear.avif"},{"revision":"356436807cbf9b5ed4cd595d3f81d90d","url":"static/img/gaj.avif"},{"revision":"88c7d704d5556f4c261a0f7a200b2fe6","url":"static/img/favicon.ico"},{"revision":"89b33b4350ea04286772839f77653b69","url":"static/img/donda_float.avif"},{"revision":"18930d4a78e8861a0acfb119d39204c7","url":"static/img/donda.avif"},{"revision":"5acb7c5a5bdb8d7dbec2ebb0d134ce7f","url":"static/img/JiK.avif"},{"revision":"80ba9e6bcf6dd23a551277b1ce615d2b","url":"static/img/404.ico"},{"revision":"909592136827d616d095d91a521f06d2","url":"static/icons/icon-512x512.avif"},{"revision":"4f8a0e4ad65798bc38e44cbce473931f","url":"static/icons/icon-384x384.avif"},{"revision":"4255e56fef7b16fc7a1ff6b87e6212ec","url":"static/icons/icon-192x192.avif"},{"revision":"cdd73b250b50d22e7ce9f973cef3cebc","url":"static/icons/icon-128x128.avif"},{"revision":"6b1d721ea5849aaa5df4e1026a74fea0","url":"static/css/styles.css"},{"revision":"bb9451db10d2de6fbc02cb321e767a97","url":"static/css/desktop-player.css"},{"revision":"7adbae910d98d8bd6b976d45b7570f89","url":"static/anim/swish.avif"},{"revision":"31b7c4cbf1e856d976c977a53a35d95f","url":"static/anim/waves.avif"},{"revision":"7cdbce85d5343a9fee9c1f2c6e363520","url":"static/anim/donda2.avif"},{"revision":"4294e61d15f203eb45b45cf484c8a7e1","url":"static/anim/yandhi.avif"},{"revision":"f5fda7f969fe2641b1ba5443cebe6faa","url":"static/anim/war.avif"},{"revision":"94b1e5453ad9338726af6c714ea38370","url":"static/anim/tgfd.avif"},{"revision":"0c1932ede18cd1a7e87640aa1420cf6d","url":"static/anim/JiK.avif"}]);

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
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'DOWNLOAD_SONGS') {
    downloadAllSongs();
  }
});

async function downloadAllSongs() {
  try {
    // Check if connection is metered
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    // Skip if on metered connection or save-data is enabled
    if (connection && (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) {
      console.log('Skipping song download: metered connection detected');
      return;
    }

    console.log('Starting background song download...');

    // Fetch song list from API
    const response = await fetch('/api/songs');
    if (!response.ok) {
      throw new Error('Failed to fetch song list');
    }

    const songs = await response.json();
    console.log(`Found ${songs.length} songs to download`);

    // Download each song in background
    const cache = await caches.open('audio');
    const downloadPromises = songs.map(async (songUrl) => {
      try {
        const response = await fetch(songUrl);
        if (response.ok) {
          await cache.put(songUrl, response);
          console.log(`Downloaded: ${songUrl}`);
        }
      } catch (error) {
        console.warn(`Failed to download ${songUrl}:`, error);
      }
    });

    await Promise.allSettled(downloadPromises);
    console.log('Song download complete');

  } catch (error) {
    console.error('Error in song download:', error);
  }
}

// Trigger song download when service worker is ready
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Small delay to let the page load first
    new Promise(resolve => setTimeout(resolve, 5000)).then(() => {
      downloadAllSongs();
    })
  );
});