// Fragment client
(function(){
    if (window.Client) return;
    window.Client = {};
    
    // Global audio playback state
    let currentAudio = null;
    let currentFile = null;
    let currentRow = null;
    let originalImageSrc = null;
    
    // Helper: parse @get('/url') expression
    function parseAction(expr) {
        if (!expr) return null;
        const m = expr.match(/@get\(['"](.+?)['"]\)/);
        if (m) return { method: 'GET', url: m[1] };
        return null;
    }
    
    // Update play indicator: toggle .playing class on the row
    function updateButton(el, isPlaying) {
        if (!el) return;
        const row = el.closest ? el.closest('.song-main') : null;
        if (row) {
            if (isPlaying) row.classList.add('playing');
            else row.classList.remove('playing');
        }
    }
    
    // Perform a fetch for the given URL and apply the returned fragment into #album-detail
    async function fetchAndPatch(url, pushHistory = true) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'Fragment-Request': 'fetch',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'text/html'
                },
                credentials: 'same-origin'
            });
            
            if (!res.ok) {
                console.error('Fetch failed', res.status);
                return;
            }
            
            const html = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Expect fragment to contain an element with id="album-detail" (album detail)
            const frag = doc.getElementById('album-detail');
            const existing = document.getElementById('album-detail');
            
            if (frag && existing) {
                existing.replaceWith(frag);
            } else if (frag && !existing) {
                // No existing placeholder — append to body
                document.body.appendChild(frag);
            } else if (existing) {
                // Fallback: inject HTML inside existing container
                existing.innerHTML = html;
            }
            
            // Reset image swap state for new album
            originalImageSrc = null;
            
            // Show it and update header/back button
            const newDetail = document.getElementById('album-detail');
            newDetail?.classList.remove('hidden');
            document.getElementById('back-btn')?.classList.remove('hidden');
            
            // Hide the grid when showing detail
            document.getElementById('album-grid')?.classList.add('hidden');
            
            // Update history
            if (pushHistory) history.pushState({}, '', url);
            
            // Re-run site init helpers if present
            try { window.cacheElements?.(); } catch(e){}
            try { window.enhanceImages?.(); } catch(e){}
            
        } catch (err) {
            console.error('Error fetching fragment', err);
        }
    }
    
    // Click delegation for data-on-click="@get('/p/...')"
    document.addEventListener('click', function(evt){
        let el = evt.target;
        
        // Check if clicking on a song row to play (desktop-only behaviour)
        const songRow = evt.target.closest('.song-main');
        if (songRow) {
            // use centralized audio element (desktop player audio if present)
            const file = songRow.getAttribute('data-file');
            const title = songRow.getAttribute('data-title') || 'Unknown';
            const albumArt = songRow.getAttribute('data-album-art') || '';

            // shared audio element: prefer desktop player's audio element
            const sharedAudio = (window.desktopPlayer && window.desktopPlayer.audio) || document.getElementById('player-audio') || (window.sharedAudio = window.sharedAudio || new Audio());

            // If same track clicked again -> reset to start and play (do not toggle)
            if (currentFile === file) {
                try {
                    sharedAudio.currentTime = 0;
                } catch (e) {
                    // ignore if not ready
                }
                sharedAudio.play();
                updateButton(songRow, true);
                // swap to anim if available
                const img = document.querySelector('.album-detail-image');
                if (img && img.dataset.anim && !originalImageSrc) {
                    originalImageSrc = img.src;
                    img.src = img.dataset.anim;
                }
            } else {
                // stop previous
                if (currentFile) {
                    updateButton(currentRow, false);
                }

                // set source and play
                if (sharedAudio.src !== file) sharedAudio.src = file;
                sharedAudio.play();

                // update state
                currentAudio = sharedAudio;
                currentFile = file;
                currentRow = songRow;
                updateButton(songRow, true);

                // Ensure desktop player shows the track and uses same audio
                if (window.desktopPlayer) {
                    window.desktopPlayer.play({ title: title, file: file, albumArt: albumArt });
                }

                // swap to anim if available
                const img = document.querySelector('.album-detail-image');
                if (img && img.dataset.anim && !originalImageSrc) {
                    originalImageSrc = img.src;
                    img.src = img.dataset.anim;
                }

                // When track ends, clear state
                sharedAudio.onended = function() {
                    updateButton(songRow, false);
                    if (img && originalImageSrc) {
                        img.src = originalImageSrc;
                        originalImageSrc = null;
                    }
                    currentAudio = null;
                    currentFile = null;
                    currentRow = null;
                };
            }

            return;
        }
        
        // Check for data-on-click attribute
        while (el && el !== document.documentElement) {
            const expr = el.getAttribute && el.getAttribute('data-on-click');
            if (expr) {
                const action = parseAction(expr);
                if (action && action.method === 'GET') {
                    evt.preventDefault();
                    fetchAndPatch(action.url, true);
                    return;
                }
            }
            el = el.parentElement;
        }
    }, { passive: false });
    
    // Basic back handler exposed globally (used by layout back button)
    // pass pauseAudio=false to avoid pausing playback when closing the detail
    window.goBack = function(pauseAudio = true) {
        history.pushState({}, '', '/');
        const existing = document.getElementById('album-detail');
        if (existing) {
            const placeholder = document.createElement('div');
            placeholder.id = 'album-detail';
            placeholder.className = 'album-detail hidden';
            existing.replaceWith(placeholder);
        }
        document.getElementById('back-btn')?.classList.add('hidden');
        // Show the grid
        document.getElementById('album-grid')?.classList.remove('hidden');
        try { window.cacheElements?.(); } catch(e){}
        // Stop any playing audio only when requested
        if (pauseAudio && currentAudio) {
            currentAudio.pause();
            updateButton(currentRow, false);
            // Swap back image if needed
            const img = document.querySelector('.album-detail-image');
            if (img && originalImageSrc) {
                img.src = originalImageSrc;
                originalImageSrc = null;
            }
            currentAudio = null;
            currentFile = null;
            currentRow = null;
        }
    };
    
    // Handle browser back/forward
    window.addEventListener('popstate', function(e){
        const path = window.location.pathname;
        if (path === '/') {
            window.goBack();
        } else if (path.startsWith('/p/')) {
            // Load album without pushing history
            fetchAndPatch(path, false);
        }
    });
    
    // Close album detail on escape
    document.addEventListener('keydown', function(e){
        if (e.key === 'Escape') {
            const pd = document.getElementById('album-detail');
            if (pd && !pd.classList.contains('hidden')) {
                // do not pause audio when closing via Escape
                window.goBack(false);
            }
        }
    });
    
    // Handle site title click navigation
    window.handleTitleClick = function() {
        if (document.querySelector('.album-detail:not(.hidden)')) {
            goBack();
            return false;
        } else if (window.location.pathname === '/') {
            return false;
        }
        return true;
    };

    // Listen for desktop player play events so client state stays in sync
    document.addEventListener('desktopplayer:play', function(e){
        try {
            const file = e?.detail?.file;
            if (!file) return;
            // find the row matching this file
            const row = document.querySelector('.song-main[data-file="' + CSS.escape(file) + '"]');
            if (row) {
                // clear previous
                if (currentRow && currentRow !== row) updateButton(currentRow, false);
                currentRow = row;
                currentFile = file;
                currentAudio = (window.desktopPlayer && window.desktopPlayer.audio) || currentAudio;
                updateButton(row, true);
            } else {
                // No matching row, just set file state
                currentFile = file;
                currentAudio = (window.desktopPlayer && window.desktopPlayer.audio) || currentAudio;
            }
        } catch (err) {
            // ignore
        }
    });
    
})();
