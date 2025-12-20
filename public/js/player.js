// Player functionality
const player = document.getElementById("player")
const playPauseBtn = document.getElementById("play-pause-btn")
const prevBtn = document.getElementById("prev-btn")
const nextBtn = document.getElementById("next-btn")
const headerDiceBtn = document.getElementById("header-dice-btn")
const playerContainer = document.querySelector(".player")

let currentSongIndex = -1
let isPlaying = false

// Cache album details to avoid repeated network requests
const albumCache = new Map()

async function getAlbumData(albumId) {
  if (albumCache.has(albumId)) return albumCache.get(albumId)
  try {
    const res = await fetch(`/api/albums/${albumId}`)
    if (!res.ok) throw new Error('Failed to fetch album')
    const data = await res.json()
    albumCache.set(albumId, data)
    return data
  } catch (err) {
    console.error('getAlbumData error:', err)
    return null
  }
}

/**
 * Initialize media session
 */
function initMediaSession() {
  if (!("mediaSession" in navigator)) return

  navigator.mediaSession.setActionHandler("play", () => {
    if (player) player.play().catch(console.error)
  })

  navigator.mediaSession.setActionHandler("pause", () => {
    if (player) player.pause()
  })

  navigator.mediaSession.setActionHandler("nexttrack", playNext)
  navigator.mediaSession.setActionHandler("previoustrack", playPrevious)

  navigator.mediaSession.setActionHandler("seekto", (event) => {
    if (player && event.seekTime !== undefined) {
      player.currentTime = event.seekTime
    }
  })
}

/**
 * Update media session metadata - call only on track change
 */
function updateMediaSessionMetadata() {
  if (!("mediaSession" in navigator)) return

  const playerTitle = document.getElementById("player-title")
  const playerSubtitle = document.getElementById("player-subtitle")

  const title = playerTitle?.textContent || "Unknown Track"
  const artist = playerSubtitle?.textContent || "Unknown Artist"
  const album = currentPlayingAlbum?.name || "Unknown Album"
  const artwork = currentPlayingAlbum?.image || "/icons/placeholder.avif"

  navigator.mediaSession.metadata = new MediaMetadata({
    title: title === "Select a song" ? "Unknown Track" : title,
    artist: artist,
    album: album,
    artwork: [
      { src: artwork, sizes: "128x128", type: "image/avif" },
      { src: artwork, sizes: "192x192", type: "image/avif" },
      { src: artwork, sizes: "256x256", type: "image/avif" },
      { src: artwork, sizes: "512x512", type: "image/avif" },
    ],
  })
}

/**
 * Update media session playback state - call only on play/pause/track change
 */
function updateMediaSessionPlaybackState() {
  if (!("mediaSession" in navigator)) return

  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused"

  if ("setPositionState" in navigator.mediaSession && player.duration) {
    navigator.mediaSession.setPositionState({
      duration: player.duration,
      playbackRate: player.playbackRate || 1,
      position: player.currentTime || 0,
    })
  }
}

/**
 * Handle clicks on player elements to navigate to album or play random
 */
function handlePlayerClick() {
  // If there's a currently playing album and it's not already being viewed
  if (currentPlayingAlbum && (!window.currentAlbum || window.currentAlbum.id !== currentPlayingAlbum.id)) {
    // Navigate to the album detail view
    if (window.showAlbumDetail) {
      window.showAlbumDetail(currentPlayingAlbum.id)
    }
  } else if (!currentPlayingAlbum) {
    // No song playing, play a random song
    if (window.playRandomSong) {
      window.playRandomSong()
    }
  }
}

/**
 * Initialize player
 */
function initPlayer() {
  playPauseBtn?.addEventListener("click", togglePlayPause)
  prevBtn?.addEventListener("click", playPrevious)
  nextBtn?.addEventListener("click", playNext)
  headerDiceBtn?.addEventListener("click", () => {
    if (window.playRandomSong) {
      window.playRandomSong()
    }
  })

  // Add click handlers for navigation
  const playerArt = document.getElementById("player-art")
  const playerTitle = document.getElementById("player-title")
  const playerSubtitle = document.getElementById("player-subtitle")

  playerArt?.addEventListener("click", handlePlayerClick)
  playerTitle?.addEventListener("click", handlePlayerClick)
  playerSubtitle?.addEventListener("click", handlePlayerClick)
  if (player) {
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onSongEnded)
    player.addEventListener("error", onPlayerError)
    player.addEventListener("loadedmetadata", () => {
      updateMediaSessionPlaybackState()
    })

    // Initial UI state
    updatePlayerUI()
  }

  // Initialize media session
  initMediaSession()
}

/**
 * Update player UI based on state
 */
function updatePlayerUI() {
  if (!playerContainer) return

  if (!player.src || player.src === "" || window.location.href === player.src) {
    playerContainer.classList.add("is-empty")
  } else {
    playerContainer.classList.remove("is-empty")
  }

  // Update songs list
  updateSongsList()
}

/**
 * Update the songs list in the player
 */
async function updateSongsList() {
  const songsList = document.getElementById("player-songs-list")
  if (!songsList) return

  // If we don't yet have album data (empty albums list), fall back to playlist rows
  const albumsWithSongs = (albums || []).filter((a) => a.hasSongs)
  if (albumsWithSongs.length === 0) {
    // Simple fallback to current playlist
    songsList.innerHTML = _currentPlaylist && _currentPlaylist.length > 0
      ? _currentPlaylist
          .map(
            (song, index) => `
      <div class="player-song-row ${index === currentSongIndex ? "active" : ""}" 
           data-album-id="${currentPlayingAlbum?.id || ''}" data-song-index="${index}"
           title="${song.title}">
        ${song.title}
      </div>
    `
          )
          .join("")
      : ""

    songsList.querySelectorAll(".player-song-row").forEach((row) => {
      row.addEventListener("click", async () => {
        const albumId = row.dataset.albumId
        const index = parseInt(row.dataset.songIndex, 10)
        const album = albumId ? await getAlbumData(albumId) : currentPlayingAlbum
        if (album && index >= 0 && index < (album.songs || _currentPlaylist).length) {
          currentSongIndex = index
          playSong((album.songs || _currentPlaylist)[index], album)
        }
      })
    })

    const active = songsList.querySelector('.player-song-row.active')
    if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }

  // Fetch album details in parallel (with caching)
  const albumDetails = await Promise.all(
    albumsWithSongs.map((a) => getAlbumData(a.id))
  )

  // Build grouped HTML for all albums (so queue shows even when no song is playing)
  const html = albumDetails
    .filter(Boolean)
    .map((album) => {
      const header = `
      <div class="player-album-header" data-album-id="${album.id}">
        <img class="player-album-thumb" src="${album.image || '/icons/placeholder.avif'}" alt="${album.name}">
        <div class="player-album-title">${album.name}</div>
      </div>`

      const songs = (album.songs || [])
        .map((song, idx) => {
          const isActive = currentPlayingAlbum && currentPlayingAlbum.id === album.id && currentSongIndex === idx
          return `
          <div class="player-song-row ${isActive ? 'active' : ''}" data-album-id="${album.id}" data-song-index="${idx}" title="${song.title}">
            ${song.title}
          </div>`
        })
        .join("")

      return `<div class="player-album-group">${header}${songs}</div>`
    })
    .join("")

  songsList.innerHTML = html

  // Add handlers: header -> show album, rows -> play song
  songsList.querySelectorAll('.player-album-header').forEach((hdr) => {
    hdr.addEventListener('click', () => {
      const albumId = hdr.dataset.albumId
      if (window.showAlbumDetail) window.showAlbumDetail(albumId)
    })
  })

  songsList.querySelectorAll('.player-song-row').forEach((row) => {
    row.addEventListener('click', async () => {
      const albumId = row.dataset.albumId
      const idx = parseInt(row.dataset.songIndex, 10)
      const album = await getAlbumData(albumId)
      if (album && album.songs && album.songs[idx]) {
        currentSongIndex = idx
        playSong(album.songs[idx], album)
      }
    })
  })

  // Scroll active into view (if any)
  const active = songsList.querySelector('.player-song-row.active')
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/**
 * Toggle play/pause
 */
function togglePlayPause() {
  if (!player.src) {
    console.log("No song to play")
    return
  }

  if (isPlaying) {
    player.pause()
  } else {
    player.play().catch((error) => {
      console.error("Failed to play:", error)
    })
  }
}

/**
 * Play next song or next album
 */
async function playNext() {
  if (_currentPlaylist.length === 0 || !currentPlayingAlbum) return

  // Within current album
  if (currentSongIndex < _currentPlaylist.length - 1) {
    currentSongIndex++
    playSong(_currentPlaylist[currentSongIndex], currentPlayingAlbum)
    return
  }

  // At end of album - find next album with songs
  let currentAlbumIndex = albums.findIndex((a) => a.id === currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex + 1; i < albums.length; i++) {
    if (albums[i].hasSongs) {
      const albumData = await getAlbumData(albums[i].id)
      if (albumData && albumData.songs && albumData.songs.length > 0) {
        playSong(albumData.songs[0], albumData)
        return
      }
    }
  }
}

/**
 * Play previous song or previous album
 */
async function playPrevious() {
  if (_currentPlaylist.length === 0 || !currentPlayingAlbum) return

  // Within current album
  if (currentSongIndex > 0) {
    currentSongIndex--
    playSong(_currentPlaylist[currentSongIndex], currentPlayingAlbum)
    return
  }

  // At beginning of album - find previous album with songs
  let currentAlbumIndex = albums.findIndex((a) => a.id === currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex - 1; i >= 0; i--) {
    if (albums[i].hasSongs) {
      const albumData = await getAlbumData(albums[i].id)
      if (albumData && albumData.songs && albumData.songs.length > 0) {
        playSong(albumData.songs[albumData.songs.length - 1], albumData)
        return
      }
    }
  }
}

/**
 * Called when song finishes
 */
function onSongEnded() {
  playNext()
}

/**
 * Called when player plays
 */
function onPlay() {
  isPlaying = true
  updatePlayPauseButton()
  updatePlayerArt()
  updatePlayerUI()
  updateMediaSessionPlaybackState()
}

/**
 * Called when player pauses
 */
function onPause() {
  isPlaying = false
  updatePlayPauseButton()
  updatePlayerArt()
  updateMediaSessionPlaybackState()
}

/**
 * Update player art based on play state
 */
function updatePlayerArt() {
  const playerArt = document.getElementById("player-art")
  const playingAlbum = currentPlayingAlbum
  if (!playerArt || !playingAlbum) return

  if (isPlaying && playingAlbum.anim) {
    // Only switch if not already showing anim
    if (!playerArt.src.includes(playingAlbum.anim)) {
      playerArt.src = playingAlbum.anim
    }
  } else {
    const imageSrc = playingAlbum.image || "/icons/placeholder.avif"
    // Only switch if not already showing image
    if (!playerArt.src.includes(imageSrc)) {
      playerArt.src = imageSrc
    }
  }
}

/**
 * Called when player encounters error
 */
function onPlayerError() {
  console.error("Player error:", player.error)
  isPlaying = false
  updatePlayPauseButton()
}

/**
 * Update play/pause button text
 */
function updatePlayPauseButton() {
  if (playPauseBtn) {
    playPauseBtn.textContent = isPlaying ? "⏸" : "▶"
  }
}

/**
 * Override playSong to track current index
 */
const originalPlaySong = window.playSong
window.playSong = (song, album) => {
  // Find index in current playlist
  currentSongIndex = album.songs.findIndex((s) => s.title === song.title)
  // Call original function
  originalPlaySong(song, album)
  // Update UI
  updatePlayerUI()
  // Update media session metadata on track change only
  updateMediaSessionMetadata()
}

// Expose updateSongsList so other modules can refresh the queue
window.updateSongsList = updateSongsList

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlayer)
} else {
  initPlayer()
}
