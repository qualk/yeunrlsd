class DesktopPlayer {
  constructor() {
    this.playerContainer = document.getElementById('desktop-player');
    this.audio = document.getElementById('player-audio');
    this.playBtn = document.getElementById('player-play-btn');
    this.timeline = document.getElementById('player-timeline');
    this.progress = document.getElementById('player-progress');
    this.playhead = document.getElementById('player-playhead');
    this.currentTimeEl = document.getElementById('player-current-time');
    this.durationEl = document.getElementById('player-duration');
    this.titleEl = document.getElementById('player-title');
    this.artistEl = document.getElementById('player-artist');
    this.albumArt = document.getElementById('player-album-art');

    this.isDragging = false;
    this.currentTrack = null;
    this.isPlaying = false;

    // Disable transitions on initial load
    this.playerContainer.classList.add('no-transition');
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.playerContainer.classList.remove('no-transition');
      }, 100);
    });

    this.initEventListeners();
  }

  initEventListeners() {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.onTrackEnded());
    this.audio.addEventListener('play', () => this.setIsPlaying(true));
    this.audio.addEventListener('pause', () => this.setIsPlaying(false));

    // Keep row UI in sync: when the desktop audio plays/pauses, toggle the .playing class
    this.audio.addEventListener('play', () => {
      const row = this.findRowBySrc(this.audio.currentSrc || this.audio.src);
      if (row) row.classList.add('playing');
    });
    this.audio.addEventListener('pause', () => {
      const row = this.findRowBySrc(this.audio.currentSrc || this.audio.src);
      if (row) row.classList.remove('playing');
    });
    this.audio.addEventListener('ended', () => {
      const row = this.findRowBySrc(this.audio.currentSrc || this.audio.src);
      if (row) row.classList.remove('playing');
    });

    this.timeline.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.endDrag());

    // (volume control removed per user request)

    // Spacebar to toggle play/pause (when not typing in inputs)
    document.addEventListener('keydown', (e) => {
      const active = document.activeElement && document.activeElement.tagName;
      if (e.code === 'Space' && active !== 'INPUT' && active !== 'TEXTAREA') {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  play(track) {
    this.currentTrack = track;
    this.audio.src = track.file;
    this.titleEl.textContent = track.title;
    this.artistEl.textContent = 'Kanye West';
    this.albumArt.src = track.albumArt || '';
    this.audio.play();
    // notify other UI that desktop player started playing this file
    try {
      document.dispatchEvent(new CustomEvent('desktopplayer:play', { detail: { file: track.file } }));
    } catch (e) {
      // ignore if CustomEvent unsupported
    }
    this.showPlayer();
    this.updatePlayButton();
  }

  togglePlay() {
    if (!this.currentTrack) return;
    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
    this.updatePlayButton();
  }

  setIsPlaying(state) {
    this.isPlaying = state;
  }

  updatePlayButton() {
    const svg = this.playBtn.querySelector('svg');
    if (this.audio.paused) {
      svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
    } else {
      svg.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
    }
  }

  findRowBySrc(src) {
    if (!src) return null;
    const rows = document.querySelectorAll('.song-main');
    for (const r of rows) {
      const f = r.getAttribute('data-file');
      if (!f) continue;
      try {
        // compare by ending segment to be robust against absolute vs relative URLs
        if (src.endsWith(f) || src === f) return r;
      } catch (e) {
        // ignore
      }
    }
    return null;
  }

  updateProgress() {
    if (!this.isDragging) {
      const percent = (this.audio.currentTime / this.audio.duration) * 100;
      this.progress.style.width = percent + '%';
      this.playhead.style.left = percent + '%';
    }
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    this.durationEl.textContent = this.formatTime(this.audio.duration);
  }

  startDrag(e) {
    this.isDragging = true;
    this.drag(e);
  }

  drag(e) {
    if (!this.isDragging || !this.audio.duration) return;

    const rect = this.timeline.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const clampedPercent = Math.max(0, Math.min(1, percent));

    this.audio.currentTime = clampedPercent * this.audio.duration;
    this.progress.style.width = clampedPercent * 100 + '%';
    this.playhead.style.left = clampedPercent * 100 + '%';
  }

  endDrag() {
    this.isDragging = false;
  }

  onTrackEnded() {
    this.updatePlayButton();
  }

  showPlayer() {
    this.playerContainer.classList.add('active');
  }

  hidePlayer() {
    this.playerContainer.classList.remove('active');
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Initialize player on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.desktopPlayer = new DesktopPlayer();
});
