// Fragment client
(function(){
    if (window.Client) return;
    window.Client = {};
    
    // Global audio playback state
    let currentAudio = null;
    let currentButton = null;
    let currentFile = null;
    let currentDurationSpan = null;
    let countdownInterval = null;
    let totalDuration = 0;
    let originalImageSrc = null;
    
    // Helper: parse @get('/url') expression
    function parseAction(expr) {
        if (!expr) return null;
        const m = expr.match(/@get\(['"](.+?)['"]\)/);
        if (m) return { method: 'GET', url: m[1] };
        return null;
    }
    
    // Update play button SVG
    function updateButton(button, isPlaying) {
        const svg = button.querySelector('svg');
        if (isPlaying) {
            // Pause icon
            svg.innerHTML = '<circle cx="12" cy="12" r="12" fill="#000"/><rect x="8" y="7" width="2" height="10" fill="#fff"/><rect x="14" y="7" width="2" height="10" fill="#fff"/>';
        } else {
            // Play icon
            svg.innerHTML = '<circle cx="12" cy="12" r="12" fill="#000"/><polygon points="9,7 9,17 17,12" fill="#fff"/>';
        }
    }
    
    // Format seconds to mm:ss
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        
        // Check if clicking on a song row to play
        const songRow = evt.target.closest('.song-main');
        if (songRow) {
            const file = songRow.getAttribute('data-file');
            const button = songRow.querySelector('.song-play');
        if (currentAudio && currentFile === file) {
                // Toggle play/pause for same song
                if (currentAudio.paused) {
                    currentAudio.play();
                    updateButton(button, true);
                    // Swap to anim if available
                    const img = document.querySelector('.album-detail-image');
                    if (img && img.dataset.anim && !originalImageSrc) {
                        originalImageSrc = img.src;
                        img.src = img.dataset.anim;
                    }
                } else {
                    currentAudio.pause();
                    updateButton(button, false);
                    // Swap back
                    const img = document.querySelector('.album-detail-image');
                    if (img && originalImageSrc) {
                        img.src = originalImageSrc;
                        originalImageSrc = null;
                    }
                }
            } else {
                // Stop current audio
                if (currentAudio) {
                    currentAudio.pause();
                    updateButton(currentButton, false);
                    // Swap back
                    const img = document.querySelector('.album-detail-image');
                    if (img && originalImageSrc) {
                        img.src = originalImageSrc;
                        originalImageSrc = null;
                    }
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                    currentDurationSpan = null;
                    totalDuration = 0;
                }
                // Play new song
                currentAudio = new Audio(file);
                currentAudio.addEventListener('loadedmetadata', () => {
                    totalDuration = currentAudio.duration;
                    currentDurationSpan = songRow.querySelector('.song-duration');
                    if (currentDurationSpan) {
                        currentDurationSpan.textContent = "0:00 / " + formatTime(totalDuration);
                    }
                    countdownInterval = setInterval(() => {
                        if (currentAudio) {
                            currentDurationSpan.textContent = formatTime(currentAudio.currentTime) + " / " + formatTime(totalDuration);
                        }
                    }, 1000);
                });
                currentAudio.addEventListener('ended', () => {
                    updateButton(button, false);
                    // Swap back
                    const img = document.querySelector('.album-detail-image');
                    if (img && originalImageSrc) {
                        img.src = originalImageSrc;
                        originalImageSrc = null;
                    }
                    currentAudio = null;
                    currentButton = null;
                    currentFile = null;
                    if (countdownInterval) {
                        clearInterval(countdownInterval);
                        countdownInterval = null;
                    }
                    currentDurationSpan = null;
                    totalDuration = 0;
                });
                currentAudio.play();
                currentButton = button;
                currentFile = file;
                updateButton(button, true);
                // Swap to anim if available
                const img = document.querySelector('.album-detail-image');
                if (img && img.dataset.anim && !originalImageSrc) {
                    originalImageSrc = img.src;
                    img.src = img.dataset.anim;
                }
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
    window.goBack = function() {
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
        // Stop any playing audio
        if (currentAudio) {
            currentAudio.pause();
            updateButton(currentButton, false);
            // Swap back
            const img = document.querySelector('.album-detail-image');
            if (img && originalImageSrc) {
                img.src = originalImageSrc;
                originalImageSrc = null;
            }
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            currentDurationSpan = null;
            totalDuration = 0;
            currentAudio = null;
            currentButton = null;
            currentFile = null;
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
                window.goBack();
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
    
})();
