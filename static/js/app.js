// Global state
let selectedProduct = null;
let cartOpen = false;

// Cached DOM elements
let elements = {};

// Cache DOM elements
function cacheElements() {
    elements = {
        productGrid: document.getElementById('product-grid'),
        productDetail: document.getElementById('product-detail'),
        backBtn: document.getElementById('back-btn'),
        cartSidebar: document.getElementById('cart-sidebar'),
        cartItems: document.getElementById('cart-items'),
        cartTotal: document.getElementById('cart-total'),
        cartQuantity: document.getElementById('cart-quantity')
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

// Size selector
function openSizeSelector() {
    const productName = document.getElementById('product-name');
    const selectSize = document.getElementById('select-size');
    const addBtn = document.getElementById('add-btn');
    const sizeButtons = document.getElementById('size-buttons');
    const closeSize = document.getElementById('close-size');
    
    // Hide product name and add button
    productName.style.transform = 'translateY(-100%)';
    productName.style.opacity = '0';
    addBtn.style.display = 'none';
    
    // Prepare select size for animation
    selectSize.style.transform = 'translateY(100%)';
    selectSize.style.opacity = '0';
    selectSize.classList.remove('hidden');
    
    // Animate select size in
    setTimeout(() => {
        selectSize.style.transform = 'translateY(0)';
        selectSize.style.opacity = '1';
    }, 50);
    
    // Animate close button in
    setTimeout(() => {
        closeSize.style.opacity = '1';
        closeSize.style.transform = 'translateX(0) translateY(0)';
    }, 100);
    
    // Show size buttons with animation
    sizeButtons.classList.remove('hidden');
    setTimeout(() => {
        sizeButtons.classList.add('show');
    }, 150);
}

function closeSizeSelector() {
    const productName = document.getElementById('product-name');
    const selectSize = document.getElementById('select-size');
    const addBtn = document.getElementById('add-btn');
    const sizeButtons = document.getElementById('size-buttons');
    const closeSize = document.getElementById('close-size');
    
    // Animate close button out
    closeSize.style.opacity = '0';
    closeSize.style.transform = 'translateX(-50%) translateY(28px)';
    
    // Hide size buttons
    sizeButtons.classList.remove('show');
    
    // Animate select size out
    selectSize.style.opacity = '0';
    selectSize.style.transform = 'translateY(100%)';
    
    // After animations complete, hide elements and show product name/add button
    setTimeout(() => {
        sizeButtons.classList.add('hidden');
        selectSize.classList.add('hidden');
        
        // Show product name and add button
        productName.style.transform = 'translateY(0)';
        productName.style.opacity = '1';
        addBtn.style.display = 'flex';
    }, 300);
}

// Add to cart
async function addToCart(productId, size) {
    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                size: size
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update cart quantity
        if (elements.cartQuantity) {
            elements.cartQuantity.textContent = data.cart_quantity;
        }
        
        // Close size selector
        closeSizeSelector();
        
        // Open cart
        toggleCart();
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        // Could show user-friendly error message here
    }
}

// Cart toggle
function toggleCart() {
    const { cartSidebar } = elements;
    
    cartOpen = !cartOpen;
    
    if (cartOpen) {
        cartSidebar?.classList.add('open');
        loadCart();
    } else {
        cartSidebar?.classList.remove('open');
    }
}

// Load cart
async function loadCart() {
    try {
        const response = await fetch('/api/cart');
        const data = await response.json();
        
        // Render cart items
        renderCartItems(data.cart);
        
        // Update total
        const cartTotal = document.getElementById('cart-total');
        if (cartTotal) {
            cartTotal.textContent = `$${data.total}`;
        }
        
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

// Render cart items
function renderCartItems(cart) {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;
    
    const sizeLabels = ['S-M', 'M-L', 'XL-XXL'];
    
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <div>
                    <p class="cart-item-name">${item.id.split('-').slice(0, 2).join('-').toUpperCase()}</p>
                    <p class="cart-item-price">$${item.price}</p>
                    <p class="cart-item-size">SIZE: ${sizeLabels[item.size]}</p>
                    <p class="cart-item-qty">QTY: ${item.quantity}</p>
                </div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', ${item.size}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', ${item.size}, 1)">+</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Update cart quantity
async function updateCartQuantity(productId, size, change) {
    try {
        const response = await fetch('/api/cart/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product_id: productId,
                size: size,
                change: change
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update cart
        loadCart();
        
        // Update cart quantity in header
        if (elements.cartQuantity) {
            elements.cartQuantity.textContent = data.cart_quantity;
        }
        
    } catch (error) {
        console.error('Error updating cart:', error);
        // Could show user-friendly error message here
    }
}

// Handle browser back/forward
window.addEventListener('popstate', function(event) {
    const path = window.location.pathname;
    if (path === '/') {
        goBack();
    } else if (path.startsWith('/p/')) {
        const productId = path.split('/').pop();
        selectProduct(productId);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (selectedProduct && event.key === 'Escape') {
        goBack();
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
        const productId = path.split('/').pop();
        selectedProduct = productId;
        elements.backBtn?.classList.remove('hidden');
    }
});