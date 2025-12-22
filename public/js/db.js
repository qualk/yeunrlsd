/**
 * IndexedDB management for offline storage
 */
const DB_NAME = "yeunrlsd-db"
const DB_VERSION = 1

const STORES = {
  ALBUMS: "albums",
  FILES: "files", // Stores blobs (audio, images)
  METADATA: "metadata", // Stores app state like 'downloaded' status
}

let db = null
// Cache for object URLs created from blobs to avoid creating many URLs and leaking memory
const blobUrlCache = new Map()
// Standardized metadata keys
const METADATA_KEYS = {
  FULL_DONE: "full_download_complete",
  TOTAL_SIZE: "total_downloaded_size",
  APP_VERSION: "app_version",
}

/**
 * Initialize the database
 */
async function initDB() {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(STORES.ALBUMS)) {
        db.createObjectStore(STORES.ALBUMS, { keyPath: "id" })
      }

      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES)
      }

      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA)
      }
    }

    request.onsuccess = (event) => {
      db = event.target.result
      resolve(db)
    }

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.error)
      reject(event.target.error)
    }
  })
}

/**
 * Save a file (blob) to IndexedDB
 */
async function saveFile(url, blob) {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.FILES], "readwrite")
    const store = transaction.objectStore(STORES.FILES)
    // If we already created an object URL for this url, revoke it since content will change
    if (blobUrlCache.has(url)) {
      try {
        URL.revokeObjectURL(blobUrlCache.get(url))
      } catch (_e) {}
      blobUrlCache.delete(url)
    }
    const request = store.put(blob, url)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a file (blob) from IndexedDB
 */
async function getFile(url) {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.FILES], "readonly")
    const store = transaction.objectStore(STORES.FILES)
    const request = store.get(url)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save album metadata
 */
async function saveAlbum(album) {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ALBUMS], "readwrite")
    const store = transaction.objectStore(STORES.ALBUMS)
    const request = store.put(album)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all saved albums
 */
async function getAlbums() {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ALBUMS], "readonly")
    const store = transaction.objectStore(STORES.ALBUMS)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Set metadata value
 */
async function setMetadata(key, value) {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.METADATA], "readwrite")
    const store = transaction.objectStore(STORES.METADATA)
    const request = store.put(value, key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get metadata value
 */
async function getMetadata(key) {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.METADATA], "readonly")
    const store = transaction.objectStore(STORES.METADATA)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a file from IndexedDB or return the original URL
 * If it's in DB, returns a Blob URL
 */
async function getFileUrl(url) {
  try {
    const blob = await getFile(url)
    if (blob) {
      console.log(`🎵 Cache hit: ${url}`)
      if (blobUrlCache.has(url)) return blobUrlCache.get(url)
      const objectUrl = URL.createObjectURL(blob)
      blobUrlCache.set(url, objectUrl)
      return objectUrl
    } else {
      console.log(`🌐 Cache miss: ${url}`)
    }
  } catch (e) {
    console.error("Error getting file from DB:", e)
  }
  return url
}

/**
 * Revoke a previously created object URL for a cached file
 */
function revokeFileUrl(url) {
  const obj = blobUrlCache.get(url)
  if (obj) {
    try {
      URL.revokeObjectURL(obj)
    } catch (_e) {
      /* ignore */
    }
    blobUrlCache.delete(url)
  }
}

/**
 * Revoke all cached object URLs (useful when clearing DB)
 */
function revokeAllFileUrls() {
  for (const obj of blobUrlCache.values()) {
    try {
      URL.revokeObjectURL(obj)
    } catch (_e) {
      /* ignore */
    }
  }
  blobUrlCache.clear()
}

/**
 * Compute total downloaded size by iterating files store and summing blob sizes.
 * Saves the result to metadata key 'total_downloaded_size'.
 */
async function computeTotalDownloadedSize() {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    try {
      const tx = database.transaction([STORES.FILES], "readonly")
      const store = tx.objectStore(STORES.FILES)
      const req = store.openCursor()
      let total = 0
      req.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          const blob = cursor.value
          if (blob && typeof blob.size === "number") total += blob.size
          cursor.continue()
        } else {
          // done
          setMetadata(METADATA_KEYS.TOTAL_SIZE, total).then(() => resolve(total))
        }
      }
      req.onerror = (e) => reject(e)
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * Cache a file in the background if not already cached
 */
async function cacheFileInBackground(url) {
  try {
    const existing = await getFile(url)
    if (existing) return

    const response = await fetch(url)
    const blob = await response.blob()
    await saveFile(url, blob)
    console.log(`Cached ${url} in background`)
  } catch (e) {
    console.error(`Failed to cache ${url} in background:`, e)
  }
}

// Export functions to window
window.db = {
  initDB,
  saveFile,
  getFile,
  getFileUrl,
  saveAlbum,
  getAlbums,
  setMetadata,
  getMetadata,
  cacheFileInBackground,
}

// Expose helper functions for managing object URLs and computing sizes
window.db.revokeFileUrl = revokeFileUrl
window.db.revokeAllFileUrls = revokeAllFileUrls
window.db.computeTotalDownloadedSize = computeTotalDownloadedSize
window.db.METADATA_KEYS = METADATA_KEYS
