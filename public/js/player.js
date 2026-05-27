// Player functionality
const player = document.getElementById("player")
const playPauseBtn = document.getElementById("play-pause-btn")
const prevBtn = document.getElementById("prev-btn")
const nextBtn = document.getElementById("next-btn")
const headerDiceBtn = document.getElementById("header-dice-btn")
const playerExpandBtn = document.getElementById("player-expand-btn")
const playerContainer = document.querySelector(".player-container")
const playerProgress = document.getElementById("player-progress")
const playerProgressFill = document.getElementById("player-progress-fill")
const playerTimeCurrent = document.getElementById("player-time-current")
const playerTimeDuration = document.getElementById("player-time-duration")

let currentSongIndex = -1
let isPlaying = false
let isSeeking = false

const fetchAlbumData = window.api?.getAlbumData || window.getAlbumData

/**
 * Format time in seconds to M:SS
 */
function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Extract dominant color from image using canvas
 */
function extractDominantColor(imgSrc) {
  return new Promise((resolve) => {
    const img = new Image()
    const isBlob = imgSrc.startsWith("blob:") || imgSrc.startsWith("data:")
    if (!isBlob) {
      img.crossOrigin = "anonymous"
    }
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = 50
        canvas.height = 50
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, 50, 50)
        const data = ctx.getImageData(0, 0, 50, 50).data
        let r = 0,
          g = 0,
          b = 0,
          count = 0
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
        r = Math.floor(r / count)
        g = Math.floor(g / count)
        b = Math.floor(b / count)
        const color = `rgb(${r}, ${g}, ${b})`
        const glow = `rgba(${r}, ${g}, ${b}, 0.25)`
        resolve({ color, glow })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imgSrc
  })
}

/**
 * Update dynamic background colors
 */
async function updateDynamicColors(imgSrc) {
  const orb = document.getElementById("dynamic-bg-orb")
  if (!orb || !imgSrc) return
  const result = await extractDominantColor(imgSrc)
  if (result) {
    document.documentElement.style.setProperty("--dynamic-color", result.color)
    document.documentElement.style.setProperty("--dynamic-glow", result.glow)
  }
}

/**
 * Update progress bar and time display
 */
function updateProgress() {
  if (!player.duration || isSeeking) return
  const percent = (player.currentTime / player.duration) * 100
  playerProgressFill.style.width = `${percent}%`
  playerTimeCurrent.textContent = formatTime(player.currentTime)
  playerTimeDuration.textContent = formatTime(player.duration)
}

/**
 * Seek to position on click
 */
function seekToPosition(e) {
  if (!player.duration) return
  const rect = playerProgress.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.currentTime = percent * player.duration
  playerProgressFill.style.width = `${percent * 100}%`
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
  const artwork =
    window.currentPlayingAlbum?.image ||
    "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"

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
  if (window.currentPlayingAlbum) {
    if (window.showAlbumDetail) {
      window.showAlbumDetail(window.currentPlayingAlbum.id)
    }
    return
  }

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

  // Progress bar interaction
  playerProgress?.addEventListener("click", seekToPosition)
  playerProgress?.addEventListener("mousedown", (e) => {
    isSeeking = true
    seekToPosition(e)
  })

  // Volume control interaction
  const volumeBar = document.getElementById("player-volume-bar")
  const volumeFill = document.getElementById("player-volume-fill")
  const volumeMuteBtn = document.getElementById("volume-mute-btn")
  const volumeMaxIcon = document.querySelector(".volume-icon-max")
  const volumeIconMuted = document.getElementById("volume-icon-muted")
  const volumeIconUnmuted = document.getElementById("volume-icon-unmuted")

  let isVolumeDragging = false
  let lastVolume = 1

  function updateVolumeUI(vol) {
    if (!volumeFill) return
    volumeFill.style.width = `${vol * 100}%`
    if (vol === 0) {
      if (volumeIconMuted) volumeIconMuted.style.display = "block"
      if (volumeIconUnmuted) volumeIconUnmuted.style.display = "none"
    } else {
      if (volumeIconMuted) volumeIconMuted.style.display = "none"
      if (volumeIconUnmuted) volumeIconUnmuted.style.display = "block"
    }
  }

  function setVolumeFromEvent(e) {
    if (!volumeBar) return
    const rect = volumeBar.getBoundingClientRect()
    let vol = (e.clientX - rect.left) / rect.width
    vol = Math.max(0, Math.min(1, vol))
    if (player) {
      player.volume = vol
      player.muted = vol === 0
    }
    updateVolumeUI(vol)
    localStorage.setItem("playerVolume", vol.toString())
  }

  if (volumeBar) {
    const savedVol = localStorage.getItem("playerVolume")
    const initialVol = savedVol !== null ? parseFloat(savedVol) : 1
    if (player) {
      player.volume = initialVol
      player.muted = initialVol === 0
    }
    updateVolumeUI(initialVol)

    volumeBar.addEventListener("mousedown", (e) => {
      isVolumeDragging = true
      setVolumeFromEvent(e)
    })
  }

  if (volumeMuteBtn) {
    volumeMuteBtn.addEventListener("click", () => {
      if (!player) return
      if (player.volume > 0) {
        lastVolume = player.volume
        player.volume = 0
        player.muted = true
      } else {
        player.volume = lastVolume || 1
        player.muted = false
      }
      updateVolumeUI(player.volume)
      localStorage.setItem("playerVolume", player.volume.toString())
    })
  }

  if (volumeMaxIcon) {
    volumeMaxIcon.style.cursor = "pointer"
    volumeMaxIcon.addEventListener("click", () => {
      if (!player) return
      player.volume = 1
      player.muted = false
      updateVolumeUI(1)
      localStorage.setItem("playerVolume", "1")
    })
  }

  document.addEventListener("mousemove", (e) => {
    if (isSeeking && player.duration) {
      const rect = playerProgress.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      playerProgressFill.style.width = `${percent * 100}%`
      const time = percent * player.duration
      playerTimeCurrent.textContent = formatTime(time)
    } else if (isVolumeDragging) {
      setVolumeFromEvent(e)
    }
  })
  document.addEventListener("mouseup", (e) => {
    if (isSeeking) {
      isSeeking = false
      if (!player.duration) return
      const rect = playerProgress.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      player.currentTime = percent * player.duration
    }
    if (isVolumeDragging) {
      isVolumeDragging = false
    }
  })

  // Player keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    const k = event.key?.toLowerCase()
    if (!k) return
    const t = event.target
    if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.nodeName ?? "")) return
    if (k === "r") return window.playRandomSong?.()
    if (k === "0" && player) player.currentTime = 0
  })

  playerExpandBtn?.addEventListener("click", async () => {
    const expanded = playerContainer?.classList.toggle("expanded")
    console.log(` Player ${expanded ? "expanded" : "collapsed"}`)

    if (expanded) {
      document.body.style.overflow = "hidden"
      await updateSongsList()
      const songsList = document.getElementById("player-songs-list")
      const targetId = window.currentPlayingAlbum?.id
      if (songsList && targetId) {
        const header = songsList.querySelector(`.player-album-header[data-album-id="${targetId}"]`)
        if (header) {
          console.log(` Scrolling to album: ${window.currentPlayingAlbum.name}`)
          header.scrollIntoView({ block: "center", behavior: "smooth" })
        }
      }
    } else {
      document.body.style.overflow = ""
    }
  })

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
      updateProgress()
    })
    player.addEventListener("timeupdate", () => {
      updateProgress()
      if (window.lastfm && isPlaying) {
        window.lastfm.onPlaybackProgress(player.currentTime)
      }
    })

    updatePlayerUI()
  }

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

  updateSongsList()
}

/**
 * Update the songs list in the player
 */
async function updateSongsList() {
  const songsList = document.getElementById("player-songs-list")
  if (!songsList) return

  const albumsWithSongs = (window.albums || []).filter((a) => a.hasSongs)

  if (albumsWithSongs.length === 0) {
    songsList.innerHTML = ""
    return
  }

  const albumDetails = await Promise.all(albumsWithSongs.map((a) => fetchAlbumData(a.id)))

  const html = albumDetails
    .filter(Boolean)
    .map((album) => {
      const isPlayingAlbum =
        window.currentPlayingAlbum && window.currentPlayingAlbum.id === album.id
      const header = `
      <div class="player-album-header${isPlayingAlbum ? " active" : ""}" data-album-id="${album.id}">
        <img class="player-album-thumb" src="${album.image || "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"}" alt="${album.name}">
        <div class="player-album-title">${window.applyTitleCase ? window.applyTitleCase(album.name) : album.name}</div>
      </div>`

      const songs = (album.songs || [])
        .map((song, idx) => {
          const isActive =
            window.currentPlayingAlbum &&
            window.currentPlayingAlbum.id === album.id &&
            currentSongIndex === idx
          const isYedit = /\s*\(Yedit\)\s*$/i.test(song.title)
          const displayTitleRaw = String(song.title)
            .replace(/\s*\(Yedit\)\s*$/i, "")
            .trim()
          const displayTitle = window.applyTitleCase
            ? window.applyTitleCase(displayTitleRaw)
            : displayTitleRaw
          return `
          <div class="player-song-row ${isActive ? "active" : ""}${isYedit && window.yeditHighlightingEnabled !== false ? " yedit" : ""}" data-album-id="${album.id}" data-song-index="${idx}" title="${displayTitle}">
            ${displayTitle}
          </div>`
        })
        .join("")

      return `<div class="player-album-group">${header}${songs}</div>`
    })
    .join("")

  songsList.innerHTML = html

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
      const album = await fetchAlbumData(albumId)
      if (album?.songs?.[idx]) {
        currentSongIndex = idx
        playSong(album.songs[idx], album)
        // Smooth scroll to the clicked song
        setTimeout(() => {
          const activeRow = songsList.querySelector(".player-song-row.active")
          if (activeRow) {
            activeRow.scrollIntoView({ block: "center", behavior: "smooth" })
          }
        }, 50)
      }
    })
  })

  const active = songsList.querySelector(".player-song-row.active")
  if (active) active.scrollIntoView({ block: "center", behavior: "smooth" })

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
  if (!window._currentPlaylist?.length || !window.currentPlayingAlbum || !window.albums?.length)
    return

  if (currentSongIndex < window._currentPlaylist.length - 1) {
    currentSongIndex++
    playSong(window._currentPlaylist[currentSongIndex], window.currentPlayingAlbum)
    return
  }

  const currentAlbumIndex = window.albums.findIndex((a) => a.id === window.currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex + 1; i < window.albums.length; i++) {
    if (window.albums[i].hasSongs) {
      const albumData = await fetchAlbumData(window.albums[i].id)
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
  if (!window._currentPlaylist?.length || !window.currentPlayingAlbum || !window.albums?.length)
    return

  if (currentSongIndex > 0) {
    currentSongIndex--
    playSong(window._currentPlaylist[currentSongIndex], window.currentPlayingAlbum)
    return
  }

  const currentAlbumIndex = window.albums.findIndex((a) => a.id === window.currentPlayingAlbum.id)
  if (currentAlbumIndex < 0) return

  for (let i = currentAlbumIndex - 1; i >= 0; i--) {
    if (window.albums[i].hasSongs) {
      const albumData = await fetchAlbumData(window.albums[i].id)
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
  document.querySelector(".now-playing")?.classList.add("playing")
}

/**
 * Called when player pauses
 */
function onPause() {
  isPlaying = false
  updatePlayPauseButton()
  updatePlayerArt()
  updateMediaSessionPlaybackState()
  document.querySelector(".now-playing")?.classList.remove("playing")
  if (window.lastfm) {
    window.lastfm.onPlaybackStop()
  }
}

/**
 * Update player art based on play state
 */
function updatePlayerArt() {
  const playerArt = document.getElementById("player-art")
  const playingAlbum = window.currentPlayingAlbum
  if (!playerArt || !playingAlbum) return
  const showAnimated = isPlaying && playingAlbum.anim && window.animatedCoverEnabled !== false
  const desired = showAnimated
    ? playingAlbum.anim
    : playingAlbum.image ||
      "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"
  if (window.media?.setImageFromPath) {
    window.media.setImageFromPath(playerArt, desired).catch((err) => {
      console.warn("media: failed to set player art", desired, err)
      playerArt.src =
        "https://cdn.jsdelivr.net/gh/qualk/yeunrlsd@main/public/icons/placeholder.avif"
    })
  } else {
    if (playerArt.dataset && playerArt.dataset.src === desired) return
    playerArt.src = desired
    playerArt.dataset.src = desired
  }
  // Update dynamic colors from album art
  updateDynamicColors(desired)
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
 * Update play/pause button icons
 */
function updatePlayPauseButton() {
  const playIcon = document.getElementById("play-icon")
  const pauseIcon = document.getElementById("pause-icon")
  if (playIcon && pauseIcon) {
    playIcon.style.display = isPlaying ? "none" : "block"
    pauseIcon.style.display = isPlaying ? "block" : "none"
  }
}

/**
 * Play a song - override from app.js
 */
function initPlaySongOverride() {
  if (!window.playSong) return

  const originalPlaySong = window.playSong
  window.playSong = (song, album) => {
    if (!album?.songs) {
      console.warn("playSong: album or songs undefined")
      return
    }
    currentSongIndex = Math.max(
      0,
      album.songs.findIndex((s) => s.title === song.title),
    )
    originalPlaySong(song, album)
    updatePlayerUI()
    updateMediaSessionMetadata()
    // Update active song highlight in detail view if visible
    const detailView = document.getElementById("detail-view")
    if (detailView && !detailView.classList.contains("hidden") && window.renderAlbumDetail) {
      window.renderAlbumDetail(album)
    }
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

window.updateSongsList = updateSongsList
window.getCurrentSongIndex = () => currentSongIndex

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initPlayer()
    setTimeout(initPlaySongOverride, 100)
  })
} else {
  initPlayer()
  setTimeout(initPlaySongOverride, 100)
}
