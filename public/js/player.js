// Player functionality
const player = document.getElementById("player")
const playPauseBtn = document.getElementById("play-pause-btn")
const prevBtn = document.getElementById("prev-btn")
const nextBtn = document.getElementById("next-btn")
const rouletteBtn = document.getElementById("roulette-btn")
const playerContainer = document.querySelector(".player")

let currentSongIndex = -1
let isPlaying = false

/**
 * Initialize player
 */
function initPlayer() {
  playPauseBtn?.addEventListener("click", togglePlayPause)
  prevBtn?.addEventListener("click", playPrevious)
  nextBtn?.addEventListener("click", playNext)
  rouletteBtn?.addEventListener("click", () => {
    if (window.playRandomSong) {
      window.playRandomSong()
    }
  })

  if (player) {
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onSongEnded)
    player.addEventListener("error", onPlayerError)
    
    // Initial UI state
    updatePlayerUI()
  }
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
 * Play next song
 */
function playNext() {
  if (_currentPlaylist.length === 0) return

  currentSongIndex = (currentSongIndex + 1) % _currentPlaylist.length
  const song = _currentPlaylist[currentSongIndex]
  if (currentAlbum && song) {
    playSong(song, currentAlbum)
  }
}

/**
 * Play previous song
 */
function playPrevious() {
  if (_currentPlaylist.length === 0) return

  currentSongIndex = currentSongIndex - 1
  if (currentSongIndex < 0) {
    currentSongIndex = _currentPlaylist.length - 1
  }
  const song = _currentPlaylist[currentSongIndex]
  if (currentAlbum && song) {
    playSong(song, currentAlbum)
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
}

/**
 * Called when player pauses
 */
function onPause() {
  isPlaying = false
  updatePlayPauseButton()
  updatePlayerArt()
}

/**
 * Update player art based on play state
 */
function updatePlayerArt() {
  const playerArt = document.getElementById("player-art")
  if (!playerArt || !currentAlbum) return

  if (isPlaying && currentAlbum.anim) {
    // Only switch if not already showing anim
    if (!playerArt.src.includes(currentAlbum.anim)) {
      playerArt.src = currentAlbum.anim
    }
  } else {
    const imageSrc = currentAlbum.image || "/img/placeholder.avif"
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
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlayer)
} else {
  initPlayer()
}
