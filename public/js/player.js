// Player functionality
const player = document.getElementById("player")
const playPauseBtn = document.getElementById("play-pause-btn")
const prevBtn = document.getElementById("prev-btn")
const nextBtn = document.getElementById("next-btn")
const headerDiceBtn = document.getElementById("header-dice-btn")
const playerExpandBtn = document.getElementById("player-expand-btn")
const playerContainer = document.querySelector(".player-container")

let currentSongIndex = -1
let isPlaying = false

// Use shared API helpers exposed on window.api
function getAlbumData(albumId) {
  if (!window.api || !window.api.getAlbumData) {
    // Fallback to direct fetch if api.js not available
    return fetch(`/api/albums/${albumId}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch((e) => {
        console.error("getAlbumData fallback error:", e)
        return null
      })
  }
  return window.api.getAlbumData(albumId)
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
      updateMediaSessionPlaybackState()
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

  const rawTitle = playerTitle?.textContent || "Unknown Track"
  const title =
    String(rawTitle)
      .replace(/\s*\(Yedit\)\s*$/i, "")
      .trim() || rawTitle
  const artist = playerSubtitle?.textContent || "Unknown Artist"
  const album = window.currentPlayingAlbum?.name || "Unknown Album"
  const artwork = window.currentPlayingAlbum?.image || "/icons/placeholder.avif"

  navigator.mediaSession.metadata = new MediaMetadata({
    title: title === "Select a song" ? "Unknown Track" : title,
    artist: artist,
    album: album,
    artwork: [
      { src: artwork, sizes: "128x128", type: "image/avif" },
      { src: artwork, sizes: "192x192", type: "image/avif" },
      { src: artwork, sizes: "256x256", type: "image/avif" },
      { src: artwork, sizes: "384x384", type: "image/avif" },
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
  // If there's a currently playing album, navigate to its album detail view.
  if (window.currentPlayingAlbum) {
    if (window.showAlbumDetail) {
      window.showAlbumDetail(window.currentPlayingAlbum.id)
    }
    return
  }

  // No song playing, play a random song
  if (window.playRandomSong) {
    window.playRandomSong()
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

  playerExpandBtn?.addEventListener("click", async () => {
    const expanded = playerContainer?.classList.toggle("expanded")
    console.log(`📱 Player ${expanded ? "expanded" : "collapsed"}`)

    // Update body overflow to prevent scrolling when expanded
    if (expanded) {
      document.body.style.overflow = "hidden"

      // Ensure songs are up-to-date, then scroll to the currently playing album if any
      await updateSongsList()
      const songsList = document.getElementById("player-songs-list")
      const targetId = window.currentPlayingAlbum?.id
      if (songsList && targetId) {
        // Find the album header and scroll into view smoothly
        const header = songsList.querySelector(`.player-album-header[data-album-id="${targetId}"]`)
        if (header) {
          console.log(`🎯 Scrolling to album: ${window.currentPlayingAlbum.name}`)
          header.scrollIntoView({ block: "center", behavior: "smooth" })
        }
      }
    } else {
      document.body.style.overflow = ""
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
    player.addEventListener("timeupdate", onTimeUpdate)

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

  // Get all albums with songs, prioritize those with songs
  const albumsWithSongs = (window.albums || []).filter((a) => a.hasSongs)

  // If no albums data yet, show nothing (will be called again once albums load)
  if (albumsWithSongs.length === 0) {
    songsList.innerHTML = ""
    return
  }

  // Fetch album details in parallel (with caching)
  const albumDetails = await Promise.all(albumsWithSongs.map((a) => getAlbumData(a.id)))

  // Build grouped HTML for all albums (so queue shows even when no song is playing)
  const html = albumDetails
    .filter(Boolean)
    .map((album) => {
      const header = `
      <div class="player-album-header" data-album-id="${album.id}">
        <img class="player-album-thumb" src="${album.image || "/icons/placeholder.avif"}" alt="${album.name}">
        <div class="player-album-title">${window.applyTitleCase ? window.applyTitleCase(album.name) : album.name}</div>
      </div>`

      const songs = (album.songs || [])
        .map((song, idx) => {
          const isActive =
            window.currentPlayingAlbum &&
            window.currentPlayingAlbum.id === album.id &&
            currentSongIndex === idx
          const isYedit = /\s*\(Yedit\)\s*$/i.test(song.title)
          const displayTitle = window.applyTitleCase
            ? window.applyTitleCase(song.title)
            : song.title
          return `
          <div class="player-song-row ${isActive ? "active" : ""}${isYedit && window.yeditHighlightingEnabled !== false ? " yedit" : ""}" data-album-id="${album.id}" data-song-index="${idx}" title="${song.title}">
            ${displayTitle}
          </div>`
        })
        .join("")

      return `<div class="player-album-group">${header}${songs}</div>`
    })
    .join("")

  songsList.innerHTML = html

  // Add handlers: header -> show album, rows -> play song
  songsList.querySelectorAll(".player-album-header").forEach((hdr) => {
    hdr.addEventListener("click", () => {
      const albumId = hdr.dataset.albumId
      if (window.showAlbumDetail) window.showAlbumDetail(albumId)
    })
  })

  songsList.querySelectorAll(".player-song-row").forEach((row) => {
    row.addEventListener("click", async () => {
      const albumId = row.dataset.albumId
      const idx = parseInt(row.dataset.songIndex, 10)
      const album = await getAlbumData(albumId)
      if (album?.songs?.[idx]) {
        currentSongIndex = idx
        playSong(album.songs[idx], album)
      }
    })
  })

  // Scroll active into view (if any)
  const active = songsList.querySelector(".player-song-row.active")
  if (active) active.scrollIntoView({ block: "center", behavior: "smooth" })

  // If the player is expanded, ensure the current album header is visible
  if (playerContainer?.classList.contains("expanded") && window.currentPlayingAlbum) {
    const header = songsList.querySelector(
      `.player-album-header[data-album-id="${window.currentPlayingAlbum.id}"]`,
    )
    if (header) header.scrollIntoView({ block: "center", behavior: "smooth" })
  }
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
  // Ensure we have prerequisites
  if (!window._currentPlaylist?.length || !window.currentPlayingAlbum || !window.albums?.length)
    return

  // Within current album - next song
  if (currentSongIndex < window._currentPlaylist.length - 1) {
    currentSongIndex++
    playSong(window._currentPlaylist[currentSongIndex], window.currentPlayingAlbum)
    return
  }

  // At end of current album - find next album with songs
  const currentAlbumIndex = window.albums.findIndex((a) => a.id === window.currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex + 1; i < window.albums.length; i++) {
    if (window.albums[i].hasSongs) {
      const albumData = await getAlbumData(window.albums[i].id)
      if (albumData?.songs?.length > 0) {
        currentSongIndex = 0
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
  // Ensure we have prerequisites
  if (!window._currentPlaylist?.length || !window.currentPlayingAlbum || !window.albums?.length)
    return

  // Within current album - previous song
  if (currentSongIndex > 0) {
    currentSongIndex--
    playSong(window._currentPlaylist[currentSongIndex], window.currentPlayingAlbum)
    return
  }

  // At beginning of current album - find previous album with songs
  const currentAlbumIndex = window.albums.findIndex((a) => a.id === window.currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex - 1; i >= 0; i--) {
    if (window.albums[i].hasSongs) {
      const albumData = await getAlbumData(window.albums[i].id)
      if (albumData?.songs?.length > 0) {
        currentSongIndex = albumData.songs.length - 1
        playSong(albumData.songs[currentSongIndex], albumData)
        return
      }
    }
  }
}

/**
 * Called when song finishes
 */
function onSongEnded() {
  if (window.autoplayEnabled === false) return
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
  // Notify Last.fm of playback stop
  if (window.lastfm) {
    window.lastfm.onPlaybackStop()
  }
}

/**
 * Called when player time updates
 */
function onTimeUpdate() {
  if (window.lastfm && isPlaying) {
    window.lastfm.onPlaybackProgress(player.currentTime)
  }
}

/**
 * Update player art based on play state
 */
function updatePlayerArt() {
  const playerArt = document.getElementById("player-art")
  const playingAlbum = window.currentPlayingAlbum
  if (!playerArt || !playingAlbum) return
  // Delegate loading to shared media helper to prefer cached blob URLs and avoid duplicate requests
  const desired =
    isPlaying && playingAlbum.anim
      ? playingAlbum.anim
      : playingAlbum.image || "/icons/placeholder.avif"
  if (window.media?.setImageFromPath) {
    window.media.setImageFromPath(playerArt, desired).catch((err) => {
      console.warn("media: failed to set player art", desired, err)
      playerArt.src = "/icons/placeholder.avif"
    })
  } else {
    if (playerArt.dataset && playerArt.dataset.src === desired) return
    playerArt.src = desired
    playerArt.dataset.src = desired
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
 * Play a song - override from app.js
 */
function initPlaySongOverride() {
  // Only override if app.js has loaded
  if (!window.playSong) return

  const originalPlaySong = window.playSong
  window.playSong = (song, album) => {
    // Find index in current playlist with bounds check
    if (!album?.songs) {
      console.warn("playSong: album or songs undefined")
      return
    }
    currentSongIndex = Math.max(
      0,
      album.songs.findIndex((s) => s.title === song.title),
    )
    // Call original function
    originalPlaySong(song, album)
    // Update UI
    updatePlayerUI()
    // Update media session metadata on track change only
    updateMediaSessionMetadata()
    // Update Last.fm
    if (window.lastfm) {
      const sanitizedTitle = String(song.title)
        .replace(/\s*\(Yedit\)\s*$/i, "")
        .trim()
      window.lastfm.onTrackChange({
        title: sanitizedTitle,
        artist: song.artist || "Kanye West",
        album: album.name,
        duration: song.duration,
      })
    }
  }
}

// Expose updateSongsList so other modules can refresh the queue
window.updateSongsList = updateSongsList

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initPlayer()
    // Wait a moment for app.js to load playSong, then override it
    setTimeout(initPlaySongOverride, 100)
  })
} else {
  initPlayer()
  setTimeout(initPlaySongOverride, 100)
}
