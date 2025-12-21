// Global application state
let albums = []
let currentAlbum = null
let currentPlayingAlbum = null
let _currentPlaylist = []

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
    const response = await fetch("/api/albums")
    const data = await response.json()
    albums = data.albums
    const serverVersion = data.version

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
 * Check for server updates
 */
async function checkUpdates(serverVersion) {
  if (!window.db) return

  const localVersion = await window.db.getMetadata("app_version")
  const isDownloaded = await window.db.getMetadata("full_download_complete")

  if (localVersion && serverVersion !== localVersion && isDownloaded) {
    // Notify user of update
    const updateConfirmed = confirm(
      "A new update is available. Would you like to sync your offline library?"
    )
    if (updateConfirmed) {
      if (window.startFullDownload) {
        window.startFullDownload()
      }
    }
  }

  // Update local version
  await window.db.setMetadata("app_version", serverVersion)
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
      5 * 60 * 1000
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
      <img src="${album.image || "/icons/placeholder.avif"}" 
           alt="${album.name}" 
           class="album-image"
           loading="lazy">
      <p class="album-name">${album.name}</p>
    </div>
  `
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
    const response = await fetch(`/api/albums/${albumId}`)
    if (!response.ok) {
      console.error("Album not found")
      return
    }

    const album = await response.json()
    currentAlbum = album
    window.currentAlbum = album
    _currentPlaylist = album.songs || []
    window._currentPlaylist = _currentPlaylist

    // Update history
    window.history.pushState({ albumId }, album.name, `/album/${albumId}`)

    // Render detail view
    renderAlbumDetail(album)

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
function renderAlbumDetail(album) {
  const songsHtml = album.songs
    .map(
      (song, index) => `
    <li class="song-row" data-song-index="${index}">
      <div class="song-main" data-song-title="${song.title}" data-song-file="${song.file}">
        <div class="song-left">
          <span class="song-title">${song.title}</span>
          ${song.credits ? `<span class="song-credits">${song.credits}</span>` : ""}
        </div>
      </div>
      <a href="${song.file}" class="song-download" download aria-label="Download">↓</a>
    </li>
  `
    )
    .join("")

  elements.albumDetail.innerHTML = `
      <div class="album-cover-section">
        <h2 class="album-title album-title--cover">${album.name}</h2>
        <img src="${album.image || "/icons/placeholder.avif"}" 
             alt="${album.name}" 
             class="album-detail-image"
             loading="eager">
      </div>
      <div class="album-info-section">
        <h2 class="album-title album-title--info">${album.name}</h2>
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
  currentPlayingAlbum = album
  window.currentPlayingAlbum = album
  _currentPlaylist = album.songs || []
  window._currentPlaylist = _currentPlaylist

  const player = document.getElementById("player")
  const playerTitle = document.getElementById("player-title")
  const playerSubtitle = document.getElementById("player-subtitle")
  const playerArt = document.getElementById("player-art")

  playerTitle.textContent = song.title
  playerSubtitle.textContent = song.artist || album.name

  // Set the player art - will use animation if available and playing
  const imageSrc = album.image || "/icons/placeholder.avif"
  const animSrc = album.anim
  const targetArt = animSrc || imageSrc

  // Try to get from DB first
  const artUrl = await window.db.getFileUrl(targetArt)
  const songUrl = await window.db.getFileUrl(song.file)

  // Preload both images
  const img = new Image()
  img.onload = () => {
    playerArt.src = artUrl
  }
  img.onerror = () => {
    playerArt.src = "/icons/placeholder.avif"
  }
  img.src = artUrl

  player.src = songUrl
  player.play()

  // Cache in background if it was a network URL
  if (songUrl === song.file) {
    window.db.cacheFileInBackground(song.file)
  }
  if (artUrl === targetArt) {
    window.db.cacheFileInBackground(targetArt)
  }
}

/**
 * Play a random song from any album
 */
async function playRandomSong() {
  if (albums.length === 0) return

  // Filter albums that have songs
  const eligibleAlbums = albums.filter((a) => a.hasSongs)
  if (eligibleAlbums.length === 0) return

  // Pick a random album
  const randomAlbumInfo = eligibleAlbums[Math.floor(Math.random() * eligibleAlbums.length)]

  try {
    const response = await fetch(`/api/albums/${randomAlbumInfo.id}`)
    const album = await response.json()

    if (album.songs && album.songs.length > 0) {
      const randomSong = album.songs[Math.floor(Math.random() * album.songs.length)]
      if (window.playSong) {
        window.playSong(randomSong, album)
      } else {
        playSong(randomSong, album)
      }
    }
  } catch (error) {
    console.error("Failed to play random song:", error)
  }
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
