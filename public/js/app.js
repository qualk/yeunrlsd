// Global application state
let albums = []
let currentAlbum = null
let _currentPlaylist = []

// Cache DOM elements
const elements = {
  albumGrid: document.getElementById("album-grid"),
  gridView: document.getElementById("grid-view"),
  detailView: document.getElementById("detail-view"),
  albumDetail: document.getElementById("album-detail"),
  backBtn: document.getElementById("back-btn"),
  headerLogo: document.getElementById("header-logo"),
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
    renderAlbumGrid()
    // Refresh player queue (in case player wants to show albums when no song playing)
    if (window.updateSongsList) window.updateSongsList()
    handleRouting()
  } catch (error) {
    console.error("Failed to load albums:", error)
  }

  // Set up event listeners
  elements.backBtn?.addEventListener("click", goBack)
  elements.headerLogo?.addEventListener("click", (e) => {
    e.preventDefault()
    goHome()
  })
  window.addEventListener("popstate", handleRouting)
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
function playSong(song, album) {
  currentPlayingAlbum = album
  _currentPlaylist = album.songs || []

  const player = document.getElementById("player")
  const playerTitle = document.getElementById("player-title")
  const playerSubtitle = document.getElementById("player-subtitle")
  const playerArt = document.getElementById("player-art")

  playerTitle.textContent = song.title
  playerSubtitle.textContent = song.credits || album.name

  // Set initial art (player.js will handle animation switch on play event)
  playerArt.src = album.image || "/icons/placeholder.avif"

  player.src = song.file
  player.play()
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
      playSong(randomSong, album)
    }
  } catch (error) {
    console.error("Failed to play random song:", error)
  }
}

// Expose to window for player.js
window.playRandomSong = playRandomSong
window.showAlbumDetail = showAlbumDetail
window.currentAlbum = currentAlbum

/**
 * Go back to grid view
 */
function goBack() {
  window.history.back()
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
  if (!backBtn) return

  const isDetailView = !elements.detailView.classList.contains("hidden")
  if (isDetailView) {
    backBtn.classList.add("visible")
  } else {
    backBtn.classList.remove("visible")
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
    goHome()
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
