// Service Worker for PWA functionality and offline storage
const DB_NAME = "yeunrlsd-db"
const DB_VERSION = 1
const STORES = {
  FILES: "files",
}

// Install event
self.addEventListener("install", () => {
  self.skipWaiting()
})

// Activate event
self.addEventListener("activate", () => {
  self.clients.claim()
})

// Fetch event - intercept and serve from IndexedDB if available
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only intercept music, images, animations, and icons
  if (
    url.pathname.startsWith("/music/") ||
    url.pathname.startsWith("/img/") ||
    url.pathname.startsWith("/anim/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      (async () => {
        try {
          const blob = await getFileFromDB(event.request.url)
          if (blob) {
            return new Response(blob, {
              headers: { "Content-Type": blob.type || "application/octet-stream" },
            })
          }
        } catch (e) {
          console.error("SW DB error:", e)
        }

        // Fallback to network
        return fetch(event.request)
      })(),
    )
  } else {
    event.respondWith(fetch(event.request))
  }
})

/**
 * Helper to get file from IndexedDB
 */
async function getFileFromDB(url) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onsuccess = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        resolve(null)
        return
      }
      const transaction = db.transaction([STORES.FILES], "readonly")
      const store = transaction.objectStore(STORES.FILES)
      const getRequest = store.get(url)
      getRequest.onsuccess = () => resolve(getRequest.result)
      getRequest.onerror = () => reject(getRequest.error)
    }
    request.onerror = (event) => reject(event.target.error)
  })
}

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
