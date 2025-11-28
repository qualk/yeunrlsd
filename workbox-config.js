// run bunx workbox-cli injectManifest workbox-config.js
module.exports = {
  swSrc: 'static/sw-src.js',
  swDest: 'sw.js',
  globDirectory: '.',
  globPatterns: [
    'static/**/*.{css,js,json,ico}',
    'static/icons/*.avif'
  ],
  // exclude large files if needed, but for now include mp3
  maximumFileSizeToCacheInBytes: 50 * 1024 * 1024, // 50MB for songs
};