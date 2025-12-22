// API helpers used across the app
const albumCache = new Map()

async function getAlbumData(albumId) {
  if (!albumId) return null
  if (albumCache.has(albumId)) return albumCache.get(albumId)
  try {
    const res = await fetch(`/api/albums/${albumId}`)
    if (!res.ok) throw new Error("Failed to fetch album")
    const data = await res.json()
    albumCache.set(albumId, data)
    return data
  } catch (e) {
    console.error("getAlbumData error:", e)
    return null
  }
}

async function getAlbumList() {
  try {
    const res = await fetch("/api/albums")
    if (!res.ok) throw new Error("Failed to fetch albums")
    const data = await res.json()
    return data
  } catch (e) {
    console.error("getAlbumList error:", e)
    return { albums: [], version: "0.0.0" }
  }
  // expose on window for simple consumption by existing modules
}

window.api = {
  getAlbumData,
  getAlbumList,
}
