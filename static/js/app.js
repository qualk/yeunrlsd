// Global state
let selectedAlbum = null;

// Cached DOM elements
let elements = {};

// Cache DOM elements
function cacheElements() {
    elements = {
        albumGrid: document.getElementById('album-grid'),
        albumDetail: document.getElementById('album-detail'),
        backBtn: document.getElementById('back-btn')
    };
}

// Enhance images to avoid visible flicker on reload: reserve space and fade them in
function enhanceImages() {
    const selectors = ['img.product-image', 'img.product-detail-image', 'img.cart-item-image'];
    const imgs = document.querySelectorAll(selectors.join(','));
    imgs.forEach(img => {
        // prefer async decoding to avoid main-thread jank
        try { img.decoding = 'async'; } catch(e) {}
        // set eager loading for above-the-fold images (if within viewport)
        try { if (img.getBoundingClientRect().top < window.innerHeight * 1.5) img.loading = 'eager'; } catch(e) {}

        // If already loaded, mark immediately
        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('img-loaded');
            return;
        }

        // Otherwise, wait for the load event and then fade in
        img.addEventListener('load', () => img.classList.add('img-loaded'), { once: true });
        img.addEventListener('error', () => img.classList.add('img-loaded'), { once: true });
    });
}


// Navigation is now handled by Datastar SSE and data-on-click attributes.

// Handle browser back/forward
window.addEventListener('popstate', function(event) {
    const path = window.location.pathname;
    if (path === '/') {
        if (window.goBack) window.goBack();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (selectedAlbum && event.key === 'Escape') {
        if (window.goBack) window.goBack();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Cache DOM elements
    cacheElements();
    // Improve image loading behavior to reduce flicker
    enhanceImages();
    
    // Check initial URL
    const path = window.location.pathname;
    if (path.startsWith('/p/')) {
        const albumId = path.split('/').pop();
        selectedAlbum = albumId;
        elements.backBtn?.classList.remove('hidden');
    }
});