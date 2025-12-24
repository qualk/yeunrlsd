/**
 * Download manager for offline support
 */

let isDownloading = false
let totalExpectedBytes = 0
let totalDownloadedBytes = 0

const downloadElements = {
  overallProgress: null,
  overallProgressText: null,
  totalSize: null,
  albumList: null,
  downloadBtn: document.getElementById("nav-download"),
  doneBtn: null,
  resetBtn: null,
}

/**
 * Initialize download manager and auto-cache covers/icons
 */
function initDownloadManager() {
  // Cache elements from index.html
  downloadElements.overallProgress = document.getElementById("overall-progress-bar")
  downloadElements.overallProgressText = document.getElementById("overall-progress-text")
  downloadElements.totalSize = document.getElementById("total-downloaded-size")
  downloadElements.albumList = document.getElementById("download-album-list")
  downloadElements.doneBtn = document.getElementById("download-done-btn")
  downloadElements.resetBtn = document.getElementById("download-reset-btn")

  downloadElements.downloadBtn?.addEventListener("click", async () => {
    // Ensure modal shows server version
    const downloadVerEl = document.getElementById("download-version")
    if (downloadVerEl) downloadVerEl.innerText = window.serverVersion || "-"
    window.Modal.open("download-modal")
    const complete = await window.db.getMetadata(window.db.METADATA_KEYS.FULL_DONE)
    if (!isDownloading) {
      if (!complete) {
        startFullDownload()
      } else {
        showCompletedDownloadView()
      }
    }
  })

  downloadElements.doneBtn?.addEventListener("click", () => {
    window.Modal.close("download-modal")
  })

  downloadElements.resetBtn?.addEventListener("click", resetDownloads)

  // Auto-cache album covers and icons on page load
  cacheImagesInBackground()

  // Check if already fully downloaded
  checkDownloadStatus()
}

/**
 * Auto-cache album covers, animations, and icon files in background on page load
 */
async function cacheImagesInBackground() {
  const albums = window.albums
  if (albums) {
    for (const album of albums) {
      if (album.image) {
        window.db.cacheFileInBackground(album.image)
      }
      if (album.anim) {
        window.db.cacheFileInBackground(album.anim)
      }
    }
  }

  const icons = [
    "/icons/404.ico",
    "/icons/favicon.ico",
    "/icons/icon-128x128.avif",
    "/icons/icon-192x192.avif",
    "/icons/icon-384x384.avif",
    "/icons/icon-512x512.avif",
    "/icons/placeholder.avif",
  ]

  for (const icon of icons) {
    window.db.cacheFileInBackground(icon)
  }
}

/**
 * Start downloading everything with byte-based progress tracking
 */
async function startFullDownload() {
  if (isDownloading) return

  const albums = window.albums
  if (!albums) return

  isDownloading = true
  totalDownloadedBytes = 0
  totalExpectedBytes = 0

  // Prepare UI
  downloadElements.albumList.innerHTML = ""
  downloadElements.doneBtn?.classList.add("hidden")

  // Preflight phase: collect all URLs and their sizes via HEAD requests
  const fileMap = {} // url -> size in bytes
  const albumUrls = {} // albumId -> [urls]

  // Show initial progress to indicate activity
  if (downloadElements.overallProgressText) {
    downloadElements.overallProgressText.innerText = "Calculating..."
  }

  for (const albumSummary of albums) {
    const urls = []
    if (albumSummary.image) urls.push(albumSummary.image)
    if (albumSummary.anim) urls.push(albumSummary.anim)

    let album = albumSummary
    try {
      const res = await fetch(`/api/albums/${albumSummary.id}`)
      if (res.ok) {
        album = await res.json()
      }
    } catch (e) {
      console.error(`Failed to fetch full data for ${albumSummary.id}`, e)
    }

    if (album.songs) {
      album.songs.forEach((song) => {
        if (song.file) urls.push(song.file)
      })
    }

    albumUrls[albumSummary.id] = urls

    // (sizes will be fetched in batch later) -- continue building albumUrls
    for (const url of urls) {
      // ensure entry exists so later loop is simpler
      if (!fileMap[url]) fileMap[url] = 0
    }
  }

  // Parallelize size HEAD checks for all unique URLs to speed up preflight
  const uniqueUrls = Object.keys(fileMap)
  const headResults = await Promise.allSettled(
    uniqueUrls.map((url) =>
      fetch(url, { method: "HEAD" })
        .then((res) => ({ url, size: parseInt(res.headers.get("content-length") || "0", 10) }))
        .catch(() => ({ url, size: 0 })),
    ),
  )
  for (const r of headResults) {
    if (r.status === "fulfilled") {
      const { url, size } = r.value
      const finalSize = Math.max(0, size || 0)
      fileMap[url] =
        finalSize === 0
          ? url.endsWith(".mp3") || url.endsWith(".m4a")
            ? 5000000
            : 200000
          : finalSize
      totalExpectedBytes += fileMap[url]
    } else {
      // Best-effort default
      const errUrl = r.reason?.url || null
      const url = errUrl || r.value?.url || null
      if (url) {
        fileMap[url] = url.endsWith(".mp3") || url.endsWith(".m4a") ? 5000000 : 200000
        totalExpectedBytes += fileMap[url]
      }
    }
  }

  if (totalExpectedBytes === 0) {
    isDownloading = false
    return
  }

  // Create album rows and progress trackers
  const albumProgressElements = {}
  albums.forEach((album) => {
    const row = createAlbumRow(album)
    downloadElements.albumList.appendChild(row)

    albumProgressElements[album.id] = {
      bar: document.getElementById(`progress-${album.id}`),
      bytesExpected: 0,
      bytesDownloaded: 0,
    }
  })

  // Calculate bytes expected per album
  for (const albumId in albumUrls) {
    const urls = albumUrls[albumId]
    let expected = 0
    urls.forEach((url) => {
      expected += fileMap[url] || 0
    })
    albumProgressElements[albumId].bytesExpected = expected
  }

  // Download each album
  for (const albumSummary of albums) {
    const progress = albumProgressElements[albumSummary.id]
    if (!progress) continue

    // Auto-scroll to current album
    const row = document.getElementById(`download-row-${albumSummary.id}`)
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }

    let album = albumSummary
    try {
      const fetched = window.api
        ? await window.api.getAlbumData(albumSummary.id)
        : await (async () => {
            const res = await fetch(`/api/albums/${albumSummary.id}`)
            return res.ok ? res.json() : null
          })()
      if (fetched) album = fetched
    } catch (_e) {
      // Use previously fetched data
    }

    // Download cover
    if (album.image) {
      await downloadAndStore(album.image, progress, fileMap)
    }

    // Download animated cover if exists
    if (album.anim) {
      await downloadAndStore(album.anim, progress, fileMap)
    }

    // Download songs
    if (album.songs) {
      for (const song of album.songs) {
        await downloadAndStore(song.file, progress, fileMap)
      }
    }

    // Mark album as saved in metadata
    await window.db.saveAlbum(album)
    document.getElementById(`download-row-${album.id}`)?.classList.add("completed")
  }

  isDownloading = false
  downloadElements.doneBtn?.classList.remove("hidden")
  document.getElementById("download-modal")?.classList.add("download-complete")
  await window.db.setMetadata(window.db.METADATA_KEYS.FULL_DONE, true)
  await window.db.setMetadata(window.db.METADATA_KEYS.TOTAL_SIZE, totalDownloadedBytes)
  checkDownloadStatus()
}

/**
 * Download a file and store it in IndexedDB
 */
async function downloadAndStore(url, progress, fileMap) {
  if (!url) return

  try {
    // Check if already exists
    const existing = await window.db.getFile(url)
    if (existing) {
      const size = fileMap[url] || 0
      updateProgress(progress, size)
      return
    }

    const response = await fetch(url)
    const blob = await response.blob()
    await window.db.saveFile(url, blob)

    // Update progress with actual downloaded size
    updateProgress(progress, blob.size)
  } catch (error) {
    console.error(`Failed to download ${url}:`, error)
    // Still update progress to avoid getting stuck
    const size = fileMap[url] || 0
    updateProgress(progress, size)
  }
}

/**
 * Update progress UI based on actual bytes downloaded
 */
function updateProgress(progress, sizeBytes) {
  progress.bytesDownloaded += sizeBytes
  totalDownloadedBytes += sizeBytes

  // Update album-level progress bar
  const albumPercent = Math.min(100, (progress.bytesDownloaded / progress.bytesExpected) * 100)
  if (progress.bar) {
    progress.bar.style.width = `${albumPercent}%`
  }

  // Update overall progress bar
  const overallPercent = Math.min(100, (totalDownloadedBytes / totalExpectedBytes) * 100)
  if (downloadElements.overallProgress) {
    downloadElements.overallProgress.style.width = `${overallPercent}%`
  }
  if (downloadElements.overallProgressText) {
    downloadElements.overallProgressText.innerText = `${Math.round(overallPercent)}%`
  }

  // Update total size display
  const sizeMB = (totalDownloadedBytes / (1024 * 1024)).toFixed(1)
  if (downloadElements.totalSize) {
    downloadElements.totalSize.innerText = `${sizeMB} MB`
  }
}

/**
 * Check if everything is downloaded and update button UI
 */
async function checkDownloadStatus() {
  const complete = await window.db.getMetadata(window.db.METADATA_KEYS.FULL_DONE)
  if (complete) {
    await showCompletedDownloadView()
  }
}

/**
 * Create an album row element for the download list
 */
function createAlbumRow(album) {
  const row = document.createElement("div")
  row.className = "download-album-row"
  row.id = `download-row-${album.id}`
  row.innerHTML = `
    <img src="${album.image || "/icons/placeholder.avif"}" class="download-album-art" alt="${album.name}">
    <div class="download-album-info">
      <div class="download-album-name">${album.name}</div>
      <div class="album-progress-bar-container">
        <div id="progress-${album.id}" class="progress-bar-fill" style="width: 0%"></div>
      </div>
    </div>
  `
  return row
}
/**
 * Render the completed-download UI and populate album rows at 100%
 */
async function showCompletedDownloadView() {
  downloadElements.downloadBtn?.classList.add("downloaded")
  // Show completed UI (populate albums, set progress to 100%)
  downloadElements.albumList.innerHTML = ""
  window.albums.forEach((album) => {
    const row = createAlbumRow(album)
    const progressBar = row.querySelector(`#progress-${album.id}`)
    if (progressBar) progressBar.style.width = "100%"
    row.classList.add("completed")
    downloadElements.albumList.appendChild(row)
  })
  if (downloadElements.overallProgress) downloadElements.overallProgress.style.width = "100%"
  if (downloadElements.overallProgressText) downloadElements.overallProgressText.innerText = "100%"

  // Ensure we have total size metadata; compute if missing
  let totalSize = await window.db.getMetadata(window.db.METADATA_KEYS.TOTAL_SIZE)
  if (!totalSize && window.db && window.db.computeTotalDownloadedSize) {
    try {
      totalSize = await window.db.computeTotalDownloadedSize()
    } catch (e) {
      console.warn("Failed to compute total downloaded size:", e)
    }
  }
  if (totalSize && downloadElements.totalSize) {
    downloadElements.totalSize.innerText = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
  }

  // Show controls
  downloadElements.doneBtn?.classList.remove("hidden")
  downloadElements.resetBtn?.classList.remove("hidden")
  document.getElementById("download-modal")?.classList.add("download-complete")
}
async function resetDownloads() {
  if (
    !confirm("Are you sure you want to reset all downloads? This will clear all offline files.")
  ) {
    return
  }

  try {
    // Clear files store
    const database = await window.db.initDB()
    const filesTx = database.transaction(["files"], "readwrite")
    const filesStore = filesTx.objectStore("files")
    filesStore.clear()

    // Clear metadata store
    const metadataTx = database.transaction(["metadata"], "readwrite")
    const metadataStore = metadataTx.objectStore("metadata")
    metadataStore.clear()
    // Revoke any object URLs held in memory and reset related metadata
    if (window.db?.revokeAllFileUrls) {
      window.db.revokeAllFileUrls()
    }
    try {
      await window.db.setMetadata(window.db.METADATA_KEYS.FULL_DONE, false)
      await window.db.setMetadata(window.db.METADATA_KEYS.TOTAL_SIZE, 0)
    } catch (_e) {
      // ignore metadata set errors
    }
  } catch (e) {
    console.error("Failed to clear IndexedDB:", e)
    alert("Failed to reset downloads. Please try again.")
    return
  }

  // Reset UI state
  totalDownloadedBytes = 0
  totalExpectedBytes = 0
  isDownloading = false

  downloadElements.albumList.innerHTML = ""
  downloadElements.overallProgress.style.width = "0%"
  downloadElements.overallProgressText.innerText = "0%"
  downloadElements.totalSize.innerText = "0.0 MB"
  downloadElements.doneBtn.classList.add("hidden")
  downloadElements.downloadBtn?.classList.remove("downloaded")
  document.getElementById("download-modal")?.classList.remove("download-complete")

  console.log("Downloads reset successfully")

  // Close modal after reset
  window.Modal.close("download-modal")
}

// Export to window
window.initDownloadManager = initDownloadManager
window.startFullDownload = startFullDownload
