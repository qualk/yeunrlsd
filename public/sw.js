// Service Worker for PWA functionality

// Install event
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

// Activate event
self.addEventListener("activate", (event) => {
  self.clients.claim()
})

// Fetch event - network only
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
