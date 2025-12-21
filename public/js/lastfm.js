// Last.fm Scrobbler, from https://github.com/monochrome-music/monochrome/blob/main/js/lastfm.js

class LastFMScrobbler {
  constructor() {
    this.API_URL = '/api/lastfm';
    this.sessionKey = null;
    this.username = null;
    this.currentTrack = null;
    this.scrobbleThreshold = 0;
    this.hasScrobbled = false;
    this.loadSession();
  }

  loadSession() {
    try {
      const session = localStorage.getItem('lastfm-session');
      if (session) {
        const data = JSON.parse(session);
        this.sessionKey = data.key;
        this.username = data.username;
      }
    } catch (error) {
      console.error('Failed to load Last.fm session:', error);
    }
  }

  saveSession(key, username) {
    this.sessionKey = key;
    this.username = username;
    localStorage.setItem('lastfm-session', JSON.stringify({
      key: key,
      username: username
    }));
  }

  clearSession() {
    this.sessionKey = null;
    this.username = null;
    localStorage.removeItem('lastfm-session');
  }

  isAuthenticated() {
    return this.sessionKey && this.username;
  }

  async makeRequest(method, params = {}, requiresAuth = false) {
    const requestParams = {
      method,
      ...params
    };

    if (requiresAuth && this.sessionKey) {
      requestParams.sk = this.sessionKey;
    }
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestParams)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Last.fm API error: ${data.message}`);
      }

      return data;
  }

  async getAuthURL() {
    try {
      const data = await this.makeRequest('auth.getToken');
      const token = data.token;
      const keyResponse = await fetch('/api/lastfm-key');
      const { api_key } = await keyResponse.json();
      return {
        url: `https://www.last.fm/api/auth/?api_key=${api_key}&token=${token}`,
        token: token
      };
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      throw error;
    }
  }

  async completeAuthentication(token) {
    try {
      const data = await this.makeRequest('auth.getSession', { token });
      if (data.session) {
        this.saveSession(data.session.key, data.session.name);
        return {
          success: true,
          username: data.session.name
        };
      }
      throw new Error('No session returned');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  async updateNowPlaying(track) {
    if (!this.isAuthenticated()) return;

    this.currentTrack = track;
    this.hasScrobbled = false;

    try {
      const params = {
        artist: track.artist || 'Kanye West',
        track: track.title
      };

      if (track.album) {
        params.album = track.album;
      }

      await this.makeRequest('track.updateNowPlaying', params, true);
      console.log('Updated now playing:', track.title);

      const duration = track.duration || 180;
      this.scrobbleThreshold = Math.min(duration * 0.5, 240);
    } catch (error) {
      // Only log if authenticated - connection issues are expected during unload
      if (this.isAuthenticated()) {
        console.error('Failed to update now playing:', error);
      }
    }
  }

  async scrobble() {
    if (!this.isAuthenticated() || !this.currentTrack || this.hasScrobbled) return;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = {
        artist: this.currentTrack.artist || 'Kanye West',
        track: this.currentTrack.title,
        timestamp: timestamp
      };

      if (this.currentTrack.album) {
        params.album = this.currentTrack.album;
      }

      if (this.currentTrack.duration) {
        params.duration = Math.floor(this.currentTrack.duration);
      }

      await this.makeRequest('track.scrobble', params, true);
      this.hasScrobbled = true;
      console.log('Scrobbled:', this.currentTrack.title);
    } catch (error) {
      console.error('Failed to scrobble:', error);
    }
  }

  onTrackChange(track) {
    if (!this.isAuthenticated()) return;
    this.updateNowPlaying(track);
  }

  onPlaybackStop() {
    this.currentTrack = null;
  }

  onPlaybackProgress(currentTime) {
    if (!this.isAuthenticated() || !this.currentTrack || this.hasScrobbled) return;

    if (currentTime >= this.scrobbleThreshold) {
      this.scrobble();
    }
  }
}

// Global Last.fm instance
window.lastfm = new LastFMScrobbler();