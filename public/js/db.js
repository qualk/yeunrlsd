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
      return URL.createObjectURL(blob)
    }
  } catch (e) {
    console.error("Error getting file from DB:", e)
  }
  return url
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
