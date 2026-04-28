// Global application state
let albums = []
let currentAlbum = null
let currentPlayingAlbum = null
let _currentPlaylist = []
let titleCaseEnabled = localStorage.getItem("titleCase") === "true" // default false
let yeditHighlightingEnabled = localStorage.getItem("yeditHighlight") !== "false" // default true
let autoplayEnabled = localStorage.getItem("autoplay") !== "false" // default true

// Expose to window so other modules (player) can read initial values
window.titleCaseEnabled = titleCaseEnabled
window.yeditHighlightingEnabled = yeditHighlightingEnabled
window.autoplayEnabled = autoplayEnabled

// Expose to window immediately
window.titleCaseEnabled = titleCaseEnabled
window.yeditHighlightingEnabled = yeditHighlightingEnabled
window.autoplayEnabled = autoplayEnabled

// Cache DOM elements
const elements = {
  albumGrid: document.getElementById("album-grid"),
  gridView: document.getElementById("grid-view"),
  detailView: document.getElementById("detail-view"),
  albumDetail: document.getElementById("album-detail"),
  backBtn: document.getElementById("back-btn"),
  headerLogo: document.getElementById("header-logo"),
  menuBtn: document.getElementById("menu-btn"),
  headerMenu: document.getElementById("header-menu"),
  navAbout: document.getElementById("nav-about"),
  navSettings: document.getElementById("nav-settings"),
  lastfmStatusText: document.getElementById("lastfm-status-text"),
  lastfmConnectBtn: document.getElementById("lastfm-connect-btn"),
  lastfmDisconnectBtn: document.getElementById("lastfm-disconnect-btn"),
}

/**
 * Initialize application
 */
async function init() {
  // Load albums from API
  try {
    const _getAlbumList = window.api?.getAlbumList || window.getAlbumList
    const data = await _getAlbumList()
    albums = data.albums
    const serverVersion = data.version
    // Expose server version to other modules
    window.serverVersion = serverVersion

    // Expose state to window for cross-script access
    window.albums = albums
    window._currentPlaylist = _currentPlaylist
    window.currentPlayingAlbum = currentPlayingAlbum
    window.currentAlbum = currentAlbum

    renderAlbumGrid()
    // Refresh player queue (in case player wants to show albums when no song playing)
    if (window.updateSongsList) window.updateSongsList()
    handleRouting()

    // Initialize download manager
    if (window.initDownloadManager) window.initDownloadManager()

    // Populate About and Download version displays (if present)
    const aboutVerEl = document.getElementById("about-version")
    const downloadVerEl = document.getElementById("download-version")
    if (aboutVerEl) aboutVerEl.innerText = serverVersion || "-"
    if (downloadVerEl) downloadVerEl.innerText = serverVersion || "-"

    // Check for updates
    checkUpdates(serverVersion)
  } catch (error) {
    console.error("Failed to load albums:", error)
  }

  // Set up event listeners
  elements.backBtn?.addEventListener("click", goBack)
  elements.headerLogo?.addEventListener("click", (e) => {
    e.preventDefault()
    goHome()
  })

  // Menu button listener
  elements.menuBtn?.addEventListener("click", toggleMenu)

  // Close menu when clicking nav items
  document.querySelectorAll(".header-nav-btn").forEach((btn) => {
    btn.addEventListener("click", closeMenu)
  })

  // About modal listeners
  elements.navAbout?.addEventListener("click", () => window.Modal.open("about-modal"))

  // Settings modal listeners
  elements.navSettings?.addEventListener("click", () => {
    updateLastFMStatus()
    window.Modal.open("settings-modal")

    // Set checkbox states
    setTimeout(() => {
      const titleCaseCheckbox = document.getElementById("title-case-checkbox")
      const yeditCheckbox = document.getElementById("yedit-highlighting-checkbox")
      const autoplayCheckbox = document.getElementById("autoplay-checkbox")

      if (titleCaseCheckbox) titleCaseCheckbox.checked = titleCaseEnabled
      if (yeditCheckbox) yeditCheckbox.checked = yeditHighlightingEnabled
      if (autoplayCheckbox) autoplayCheckbox.checked = autoplayEnabled

      // Add event listeners
      titleCaseCheckbox?.addEventListener("change", (e) => {
        titleCaseEnabled = e.target.checked
        window.titleCaseEnabled = titleCaseEnabled
        localStorage.setItem("titleCase", titleCaseEnabled)
        // Re-render to apply changes
        renderAlbumGrid()
        if (currentAlbum) {
          renderAlbumDetail(currentAlbum)
        }
        if (window.updateSongsList) window.updateSongsList()
      })

      yeditCheckbox?.addEventListener("change", (e) => {
        yeditHighlightingEnabled = e.target.checked
        window.yeditHighlightingEnabled = yeditHighlightingEnabled
        localStorage.setItem("yeditHighlight", yeditHighlightingEnabled)
        // Re-render to apply changes
        renderAlbumGrid()
        if (currentAlbum) {
          renderAlbumDetail(currentAlbum)
        }
        if (window.updateSongsList) window.updateSongsList()
      })

      autoplayCheckbox?.addEventListener("change", (e) => {
        autoplayEnabled = e.target.checked
        window.autoplayEnabled = autoplayEnabled
        localStorage.setItem("autoplay", autoplayEnabled)
      })
    }, 100)
  })
  elements.lastfmConnectBtn?.addEventListener("click", connectLastFM)
  elements.lastfmDisconnectBtn?.addEventListener("click", disconnectLastFM)

  // Close menu when clicking elsewhere
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".header-menu-btn") && !e.target.closest(".header-menu")) {
      closeMenu()
    }
  })

  window.addEventListener("popstate", handleRouting)
}

/**
 * Apply title case to a string if enabled
 */
function applyTitleCase(str) {
  if (!titleCaseEnabled) return str
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

// Expose to window for cross-script access
window.applyTitleCase = applyTitleCase

/**
 * Check for server updates
 */
async function checkUpdates(serverVersion) {
  if (!window.db) return

  const localVersion = await window.db.getMetadata(window.db.METADATA_KEYS.APP_VERSION)
  const isDownloaded = await window.db.getMetadata(window.db.METADATA_KEYS.FULL_DONE)

  if (localVersion && serverVersion !== localVersion && isDownloaded) {
    // Open forced update modal and display versions
    const serverEl = document.getElementById("server-version")
    const localEl = document.getElementById("local-version")
    if (serverEl) serverEl.innerText = serverVersion || "-"
    if (localEl) localEl.innerText = localVersion || "-"

    // Update header badge: "local ➜ server"
    const headerBadge = document.getElementById("update-version")
    if (headerBadge) headerBadge.innerText = `${localVersion || "-"} ➜ ${serverVersion || "-"}`

    window.Modal.open("update-modal")

    // Wire update button (guard to avoid duplicate handlers)
    const btn = document.getElementById("update-now-btn")
    if (btn && !btn.dataset.bound) {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true
          // Close the update modal immediately so the download modal is visible
          window.Modal.close("update-modal")
          // Open the download modal UI and start the full download
          window.Modal.open("download-modal")
          if (window.startFullDownload) await window.startFullDownload()

          // After successful download, update stored app version
          try {
            await window.db.setMetadata(window.db.METADATA_KEYS.APP_VERSION, serverVersion)
          } catch (_e) {
            // ignore
          }
        } finally {
          btn.disabled = false
          // Close the forced update modal (programmatic close allowed)
          window.Modal.close("update-modal")
        }
      })
      btn.dataset.bound = "true"
    }
  }

  // If we have no recorded localVersion, set it to serverVersion (first-run sync marker)
  if (!localVersion) {
    try {
      await window.db.setMetadata(window.db.METADATA_KEYS.APP_VERSION, serverVersion)
    } catch (_e) {
      // ignore
    }
  }
}

/**
 * Toggle menu open/closed
 */
function toggleMenu() {
  const isOpen = elements.headerMenu?.classList.contains("open")
  if (isOpen) {
    closeMenu()
  } else {
    openMenu()
  }
}

/**
 * Open menu
 */
function openMenu() {
  elements.headerMenu?.classList.add("open")
  elements.menuBtn?.setAttribute("aria-expanded", "true")
}

/**
 * Close menu
 */
function closeMenu() {
  elements.headerMenu?.classList.remove("open")
  elements.menuBtn?.setAttribute("aria-expanded", "false")
}

/**
 * Update Last.fm status display
 */
function updateLastFMStatus() {
  if (!window.lastfm) return

  if (window.lastfm.isAuthenticated()) {
    elements.lastfmStatusText.textContent = `Connected as ${window.lastfm.username}`
    elements.lastfmConnectBtn.classList.add("hidden")
    elements.lastfmDisconnectBtn.classList.remove("hidden")
  } else {
    elements.lastfmStatusText.textContent = "Not connected"
    elements.lastfmConnectBtn.classList.remove("hidden")
    elements.lastfmDisconnectBtn.classList.add("hidden")
  }
}

/**
 * Connect to Last.fm
 */
async function connectLastFM() {
  if (!window.lastfm) return

  try {
    const authData = await window.lastfm.getAuthURL()
    const authWindow = window.open(authData.url, "lastfm-auth", "width=800,height=600")

    if (!authWindow) {
      alert("Pop-up blocked. Please allow pop-ups for Last.fm authentication.")
      return
    }

    // Poll for authentication completion with timeout
    let pollTimer
    const timeoutTimer = setTimeout(
      () => {
        clearInterval(pollTimer)
        console.warn("Last.fm authentication timeout")
      },
      5 * 60 * 1000,
    ) // 5 minute timeout

    pollTimer = setInterval(async () => {
      try {
        if (authWindow.closed) {
          clearInterval(pollTimer)
          clearTimeout(timeoutTimer)
          const result = await window.lastfm.completeAuthentication(authData.token)
          if (result.success) {
            updateLastFMStatus()
            alert(`Successfully connected to Last.fm as ${result.username}!`)
          }
        }
      } catch (error) {
        clearInterval(pollTimer)
        clearTimeout(timeoutTimer)
        console.error("Authentication failed:", error)
        alert("Failed to connect to Last.fm. Please try again.")
      }
    }, 1000)
  } catch (error) {
    console.error("Failed to start Last.fm authentication:", error)
    alert("Failed to start Last.fm authentication. Please try again.")
  }
}

/**
 * Disconnect from Last.fm
 */
function disconnectLastFM() {
  if (!window.lastfm) return

  if (confirm("Are you sure you want to disconnect from Last.fm?")) {
    window.lastfm.clearSession()
    updateLastFMStatus()
  }
}

/**
 * Go to home view
 */
function goHome() {
  if (window.location.pathname !== "/") {
    window.history.pushState({}, "", "/")
    handleRouting()
  }
}

/**
 * Render album grid
 */
function renderAlbumGrid() {
  elements.albumGrid.innerHTML = albums
    .map(
      (album) => `
      <div class="album-item ${!album.hasSongs ? "empty" : ""}" 
           role="listitem" 
           tabindex="${album.hasSongs ? "0" : "-1"}"
           aria-disabled="${!album.hasSongs ? "true" : "false"}"
           ${album.hasSongs ? `data-album-id="${album.id}"` : ""}>
        <img src="${album.image || "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"}" 
             alt="${album.name}" 
             class="album-image"
             loading="lazy">
        <p class="album-name">${applyTitleCase(album.name)}</p>
      </div>
    `,
    )
    .join("")

  // Add click handlers to interactive albums
  elements.albumGrid.querySelectorAll("[data-album-id]").forEach((item) => {
    item.addEventListener("click", (e) => {
      const albumId = e.currentTarget.dataset.albumId
      showAlbumDetail(albumId)
    })

    // Handle keyboard navigation
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const albumId = e.currentTarget.dataset.albumId
        showAlbumDetail(albumId)
      }
    })
  })

  // Enhance image loading
  enhanceImages()
}

/**
 * Show album detail view
 */
async function showAlbumDetail(albumId) {
  try {
    const _getAlbumData = window.api?.getAlbumData || window.getAlbumData
    const album = await _getAlbumData(albumId)
    if (!album) {
      console.error("Album not found")
      return
    }
    currentAlbum = album
    window.currentAlbum = album
    _currentPlaylist = album.songs || []
    window._currentPlaylist = _currentPlaylist

    // Update history
    window.history.pushState({ albumId }, album.name, `/album/${albumId}`)

    // Render detail view
    await renderAlbumDetail(album)

    // Switch views
    elements.gridView.classList.add("hidden")
    elements.detailView.classList.remove("hidden")
    updateBackButtonVisibility()

    // Scroll to top
    elements.detailView.scrollTop = 0
  } catch (error) {
    console.error("Failed to load album:", error)
  }
}

/**
 * Render album detail
 */
async function renderAlbumDetail(album) {
  const songsHtml = await Promise.all(
    album.songs.map(async (song, index) => {
      const songUrl = await window.db.getFileUrl(song.file)
      const filename = song.file.split("/").pop()
      const isYedit = /\s*\(Yedit\)\s*$/i.test(song.title)
      const yClass = isYedit && yeditHighlightingEnabled ? " yedit" : ""
      const displayTitleRaw = String(song.title)
        .replace(/\s*\(Yedit\)\s*$/i, "")
        .trim()
      const displayTitle = applyTitleCase(displayTitleRaw)
      return `
    <li class="song-row${yClass}" data-song-index="${index}" data-yedit="${isYedit ? "true" : "false"}">
      <div class="song-main" data-song-title="${song.title}" data-song-file="${songUrl}" title="${displayTitle}">
        <div class="song-left">
          <span class="song-title">${displayTitle}</span>
          ${song.artist ? `<span class="song-artist">${song.artist}</span>` : ""} 
        </div>
      </div>
      <a href="${songUrl}" class="song-download" download="${filename}" aria-label="Download">↓</a>
    </li>
  `
    }),
  ).then((results) => results.join(""))

  elements.albumDetail.innerHTML = `
      <div class="album-cover-section">
        <h2 class="album-title album-title--cover">${applyTitleCase(album.name)}</h2>
        <img src="${album.image || "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"}" 
             alt="${album.name}" 
             class="album-detail-image"
             loading="eager">
      </div>
      <div class="album-info-section">
        <h2 class="album-title album-title--info">${applyTitleCase(album.name)}</h2>
        <div class="songs-section">
          <ul class="songs-list">
            ${songsHtml || '<li class="no-songs">No songs available yet.</li>'}
          </ul>
        </div>
      </div>
    `

  // Add event listeners to songs
  elements.albumDetail.querySelectorAll("[data-song-index]").forEach((row) => {
    row.addEventListener("click", (e) => {
      // Don't trigger if clicking download button
      if (e.target.closest(".song-download")) {
        return
      }

      const index = parseInt(row.dataset.songIndex, 10)
      const song = album.songs[index]
      if (song) {
        playSong(song, album)
      }
    })
  })

  // Enhance image loading
  enhanceImages()
}

/**
 * Play a song
 */
async function playSong(song, album) {
  const displayTitleRaw = String(song.title)
    .replace(/\s*\(Yedit\)\s*$/i, "")
    .trim()
  const displayTitle = applyTitleCase(displayTitleRaw)
  console.log(`🎶 Playing: ${displayTitle} from ${album.name}`)

  currentPlayingAlbum = album
  window.currentPlayingAlbum = album
  _currentPlaylist = album.songs || []
  window._currentPlaylist = _currentPlaylist

  const player = document.getElementById("player")
  const playerTitle = document.getElementById("player-title")
  const playerSubtitle = document.getElementById("player-subtitle")
  const playerArt = document.getElementById("player-art")

  playerTitle.textContent = displayTitle
  playerSubtitle.textContent = song.artist || album.name

  // Set the player art - will use animation if available and playing
  const imageSrc =
    album.image || "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"
  const animSrc = album.anim
  const targetArt = animSrc || imageSrc

  // Try to get song URL from DB (audio may be cached)
  const songUrl = await window.db.getFileUrl(song.file)

  // Set player art via centralized helper that prefers cached files and preloads
  if (window.media?.setImageFromPath) {
    window.media.setImageFromPath(playerArt, targetArt).catch((err) => {
      console.warn("media: failed to set player art", targetArt, err)
      playerArt.src =
        "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"
    })
  } else {
    // Fallback: immediate set
    playerArt.src = artUrl
    playerArt.dataset.src = targetArt
  }

  player.src = songUrl
  player.play()

  // Cache in background (db method is idempotent and will skip if already cached)
  window.db.cacheFileInBackground(song.file)
  if (targetArt) window.db.cacheFileInBackground(targetArt)
}

// Play a random song

async function playRandomSong() {
  if (!albums || albums.length === 0) return

  const _fetchAlbumData = window.api?.getAlbumData || window.getAlbumData

  // Prefer current (enlarged) album when visible
  const detailOpen = elements?.detailView && !elements.detailView.classList.contains("hidden")
  if (detailOpen && currentAlbum) {
    // Try cached songs first
    if (currentAlbum.songs && currentAlbum.songs.length > 0) {
      const song = currentAlbum.songs[Math.floor(Math.random() * currentAlbum.songs.length)]
      if (song) return (window.playSong || playSong)(song, currentAlbum)
    }

    // Try fetching the current album if cached version has no songs
    if (currentAlbum.id) {
      const albumData = await _fetchAlbumData(currentAlbum.id)
      if (albumData?.songs?.length) {
        const song = albumData.songs[Math.floor(Math.random() * albumData.songs.length)]
        if (song) return (window.playSong || playSong)(song, albumData)
      }
    }
  }

  // Fallback: pick a random album with songs
  const candidates = (albums || []).filter((a) => a.hasSongs)
  if (!candidates.length) return

  // Shuffle candidates (Fisher-Yates)
  const shuffled = candidates.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  for (const info of shuffled) {
    const album = await _fetchAlbumData(info.id)
    if (album?.songs?.length) {
      const song = album.songs[Math.floor(Math.random() * album.songs.length)]
      if (song) return (window.playSong || playSong)(song, album)
    }
  }

  console.warn("🎲: no songs found in any candidate album")
}

// Expose functions to window for player.js
window.playRandomSong = playRandomSong
window.showAlbumDetail = showAlbumDetail

/**
 * Go back to grid view
 */
function goBack() {
  goHome()
}

/**
 * Handle routing based on URL
 */
function handleRouting() {
  const path = window.location.pathname

  if (path.startsWith("/album/")) {
    const albumId = path.split("/").pop()
    if (albumId) {
      const album = albums.find((a) => a.id === albumId)
      if (album?.hasSongs) {
        showAlbumDetail(albumId)
        return
      }
    }
  }

  // Default to grid view
  currentAlbum = null
  elements.gridView.classList.remove("hidden")
  elements.detailView.classList.add("hidden")
  updateBackButtonVisibility()
}

/**
 * Update back button visibility based on current view
 */
function updateBackButtonVisibility() {
  const backBtn = document.getElementById("back-btn")
  const menuBtn = document.getElementById("menu-btn")
  if (!backBtn) return

  const isDetailView = !elements.detailView.classList.contains("hidden")
  if (isDetailView) {
    backBtn.classList.add("visible")
    menuBtn?.style.setProperty("display", "none")
  } else {
    backBtn.classList.remove("visible")
    menuBtn?.style.setProperty("display", "flex")
  }
}

/**
 * Enhance image loading with fade-in effect
 */
function enhanceImages() {
  const images = document.querySelectorAll("img.album-image, img.album-detail-image")
  images.forEach((img) => {
    // Prefer async decoding
    try {
      img.decoding = "async"
    } catch (_e) {
      // Ignore
    }

    // If already loaded, mark immediately
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add("img-loaded")
      return
    }

    // Otherwise, wait for the load event
    img.addEventListener("load", () => img.classList.add("img-loaded"), { once: true })
    img.addEventListener("error", () => img.classList.add("img-loaded"), { once: true })
  })
}

/**
 * Keyboard shortcuts
 */
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    // Only go home if no modal is open
    const isModalOpen = document.querySelector(".modal-overlay.active")
    if (!isModalOpen) {
      goHome()
    }
  }
  if (event.code === "Space") {
    event.preventDefault()
    const player = document.getElementById("player")
    if (player?.src) {
      if (player.paused) {
        player.play()
      } else {
        player.pause()
      }
    }
  }
})

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
