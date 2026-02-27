/**
 * TITAN Marketplace — Frontend Cart Engine & UI
 *
 * Covers:
 *  - Product fetching from /api/products (with category + search + sort)
 *  - Cart persisted in localStorage ('titan_cart')
 *  - Quantity management (no duplicates — increments qty instead)
 *  - Checkout form → POST /api/checkout
 *  - Toast notifications + micro-animations
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let allProducts = [];
let activeCategory = 'all';
let activeSearch   = '';
let activeSort     = '';

// ─── Cart (localStorage-backed) ───────────────────────────────────────────
const CART_KEY = 'titan_cart';

let cart = loadCart();

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// ─── Cart CRUD ────────────────────────────────────────────────────────────

function addToCart(productId) {
  const product = allProducts.find(p => String(p._id) === String(productId));
  if (!product) return;

  const existing = cart.find(item => String(item._id) === String(productId));

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
    showToast(`Quantity updated: ${product.name}`, 'info');
  } else {
    cart.push({ ...product, quantity: 1 });
    showToast(`Added to cart: ${product.name}`, 'success');
  }

  saveCart();
  updateCartUI();
  bumpCartIcon();
}

function removeFromCart(productId) {
  cart = cart.filter(item => String(item._id) !== String(productId));
  saveCart();
  updateCartUI();
}

function changeQty(productId, delta) {
  const item = cart.find(i => String(i._id) === String(productId));
  if (!item) return;

  item.quantity = (item.quantity || 1) + delta;

  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  saveCart();
  updateCartUI();
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

// ─── Cart UI ──────────────────────────────────────────────────────────────

function updateCartUI() {
  // Update badge
  const count = getCartCount();
  const badge = document.getElementById('cartCount');
  badge.textContent = count;

  // Render cart body
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');

  if (cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty-state">
        <div class="empty-icon">🛍️</div>
        <p>Your cart is empty.<br/>Start adding some amazing products!</p>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  body.innerHTML = cart.map(item => `
    <div class="cart-item" id="cart-item-${item._id}">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
      <div class="cart-item-info">
        <div class="cart-item-name" title="${item.name}">${item.name}</div>
        <div class="cart-item-price">$${(item.price * (item.quantity || 1)).toFixed(2)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQty('${item._id}', -1)" aria-label="Decrease">−</button>
          <span class="qty-value">${item.quantity || 1}</span>
          <button class="qty-btn" onclick="changeQty('${item._id}', 1)" aria-label="Increase">+</button>
          <button class="remove-btn" onclick="removeFromCart('${item._id}')">Remove</button>
        </div>
      </div>
    </div>
  `).join('');

  const total = getCartTotal();
  const count2 = getCartCount();

  footer.innerHTML = `
    <div class="cart-subtotal">
      <span>${count2} item${count2 !== 1 ? 's' : ''}</span>
      <span>Subtotal</span>
    </div>
    <div class="cart-total">
      <span>Total</span>
      <span>$${total.toFixed(2)}</span>
    </div>
    <button class="btn-primary checkout-btn" onclick="openCheckout()">
      Proceed to Checkout
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <button class="clear-cart-btn" onclick="clearCart()">Clear Cart</button>
  `;
}

function bumpCartIcon() {
  const badge = document.getElementById('cartCount');
  badge.classList.remove('bump');
  void badge.offsetWidth; // reflow trick to restart animation
  badge.classList.add('bump');
}

// ─── Cart Drawer Toggle ───────────────────────────────────────────────────

function toggleCart() {
  const drawer  = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const isOpen  = drawer.classList.contains('open');

  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  } else {
    updateCartUI();
    drawer.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
}

// ─── Product Fetching ─────────────────────────────────────────────────────

async function fetchProducts() {
  showSpinner(true);

  const params = new URLSearchParams();
  if (activeCategory && activeCategory !== 'all') params.set('category', activeCategory);
  if (activeSearch)   params.set('search', activeSearch);
  if (activeSort)     params.set('sort', activeSort);

  try {
    const res = await fetch(`/api/products?${params}`);
    if (!res.ok) throw new Error('Network error');
    const products = await res.json();
    allProducts = products; // keep global reference up-to-date
    renderProducts(products);
  } catch (err) {
    console.error('fetchProducts error:', err);
    showSpinner(false);
    showEmptyState(true, 'Failed to load products. Is your server running?');
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    renderCategoryTabs(data);
  } catch {
    console.warn('Could not fetch categories');
  }
}

// ─── Product Rendering ────────────────────────────────────────────────────

function renderProducts(products) {
  showSpinner(false);
  const grid = document.getElementById('productGrid');

  if (products.length === 0) {
    grid.innerHTML = '';
    showEmptyState(true);
    return;
  }

  showEmptyState(false);

  grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}

function productCardHTML(p) {
  const badgeClass = badgeColorClass(p.badge);
  const badgeHTML  = p.badge
    ? `<span class="product-badge ${badgeClass}">${p.badge}</span>`
    : '';

  const stars = renderStars(p.rating);

  return `
    <article class="product-card" title="${p.name}">
      <div class="product-img-wrap">
        <img
          src="${p.image}"
          alt="${p.name}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1560472355-536de3962603?w=600&q=80'"
        />
        ${badgeHTML}
        <div class="quick-add-btn" onclick="addToCartAnimated(event, '${p._id}')">
          + Quick Add
        </div>
      </div>
      <div class="product-body">
        <p class="product-category">${p.category}</p>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-meta">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <span class="product-rating">
            <span class="stars">${stars}</span>
            <span>${p.rating} (${p.reviews?.toLocaleString()})</span>
          </span>
        </div>
        <button
          class="add-btn"
          onclick="addToCartAnimated(event, '${p._id}')"
          aria-label="Add ${p.name} to cart"
        >
          Add to Cart
        </button>
      </div>
    </article>
  `;
}

function addToCartAnimated(event, productId) {
  event.stopPropagation();
  const btn = event.currentTarget;
  btn.classList.remove('pop');
  void btn.offsetWidth;
  btn.classList.add('pop');
  addToCart(productId);
}

function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function badgeColorClass(badge) {
  const map = {
    'Best Seller': 'badge-best-seller',
    'New':         'badge-new',
    'Hot':         'badge-hot',
    'Sale':        'badge-sale',
    'Premium':     'badge-premium',
    'Luxury':      'badge-luxury',
  };
  return map[badge] || '';
}

// ─── Category Tabs ────────────────────────────────────────────────────────

function renderCategoryTabs(categories) {
  const bar = document.getElementById('filterBar');
  // Keep the existing "All" button
  const allBtn = bar.querySelector('[data-cat="all"]');
  bar.innerHTML = '';
  bar.appendChild(allBtn);

  categories.forEach(({ _id: cat }) => {
    const btn = document.createElement('button');
    btn.className = 'filter-tab';
    btn.dataset.cat = cat;
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.onclick = () => filterByCategory(cat, btn);
    bar.appendChild(btn);
  });
}

function filterByCategory(category, el) {
  activeCategory = category;
  activeSearch   = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('sortSelect').value  = '';
  activeSort = '';

  // Update active tab styling
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  fetchProducts();
}

// ─── Search & Sort ────────────────────────────────────────────────────────

function handleSearch() {
  activeSearch   = document.getElementById('searchInput').value.trim();
  activeCategory = 'all';
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-cat="all"]').classList.add('active');
  fetchProducts();
}

function handleSort() {
  activeSort = document.getElementById('sortSelect').value;
  fetchProducts();
}

// ─── Category links in footer ─────────────────────────────────────────────
// Allow ?category=electronics URL param to pre-filter on load
function applyURLParams() {
  const params = new URLSearchParams(window.location.search);
  const cat    = params.get('category');
  if (cat) {
    activeCategory = cat;
    // Highlight correct tab once they're rendered
    setTimeout(() => {
      const tab = document.querySelector(`[data-cat="${cat}"]`);
      if (tab) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      }
    }, 600);
  }
}

// ─── Checkout ─────────────────────────────────────────────────────────────

function openCheckout() {
  if (cart.length === 0) {
    showToast('Your cart is empty!', 'error');
    return;
  }

  // Close cart drawer first
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  drawer.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';

  // Populate order summary
  const summaryDiv = document.getElementById('orderSummary');
  summaryDiv.innerHTML = cart.map(item => `
    <div class="summary-item">
      <span class="summary-item-name">${item.name} × ${item.quantity || 1}</span>
      <span class="summary-item-price">$${(item.price * (item.quantity || 1)).toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('orderTotal').innerHTML = `
    <span>Grand Total</span>
    <span>$${getCartTotal().toFixed(2)}</span>
  `;

  document.getElementById('checkoutOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

async function submitOrder(event) {
  event.preventDefault();

  const name    = document.getElementById('custName').value.trim();
  const email   = document.getElementById('custEmail').value.trim();
  const address = document.getElementById('custAddress').value.trim();

  if (!name || !email) {
    showToast('Name and email are required.', 'error');
    return;
  }

  // Show loading state
  const btn       = document.getElementById('submitBtn');
  const btnText   = btn.querySelector('span');
  const btnSpin   = btn.querySelector('.btn-spinner');
  btn.disabled    = true;
  btnText.textContent = 'Placing order…';
  btnSpin.classList.remove('hidden');

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name, email, address },
        items: cart,
        total: getCartTotal(), // server will re-verify anyway
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Checkout failed');

    // Success
    closeCheckout();
    clearCart();
    document.getElementById('checkoutForm').reset();
    showConfirmation(data.orderId, name, data.total);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Place Order';
    btnSpin.classList.add('hidden');
  }
}

// ─── Confirmation ─────────────────────────────────────────────────────────

function showConfirmation(orderId, customerName, total) {
  document.getElementById('confirmOrderId').textContent = orderId;
  document.getElementById('confirmMsg').textContent =
    `Thank you, ${customerName}! Your $${Number(total).toFixed(2)} order is confirmed.`;
  document.getElementById('confirmOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── Toast ────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '💬'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function showSpinner(show) {
  document.getElementById('spinner').style.display   = show ? 'flex' : 'none';
  document.getElementById('productGrid').style.display = show ? 'none' : 'grid';
}

function showEmptyState(show, message) {
  const el = document.getElementById('emptyState');
  if (show) {
    el.classList.remove('hidden');
    if (message) el.querySelector('p').textContent = message;
    else el.querySelector('p').textContent = 'Try a different category or search term.';
  } else {
    el.classList.add('hidden');
  }
}

function scrollToProducts() {
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ─── Navbar scroll effect ─────────────────────────────────────────────────

window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 20) navbar.classList.add('scrolled');
  else navbar.classList.remove('scrolled');
}, { passive: true });

// ─── Search on Enter ──────────────────────────────────────────────────────
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});
// Mobile search input sync
document.getElementById('mobileSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleMobileSearch();
});

// ─── Mobile Search Toggle ────────────────────────────────────────────────────
function toggleMobileSearch() {
  const bar    = document.getElementById('mobileSearchBar');
  const input  = document.getElementById('mobileSearchInput');
  const isOpen = bar.classList.contains('open');

  if (isOpen) {
    bar.classList.remove('open');
  } else {
    bar.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }
}

function handleMobileSearch() {
  const val = document.getElementById('mobileSearchInput').value.trim();
  // Sync with desktop input
  document.getElementById('searchInput').value = val;
  activeSearch   = val;
  activeCategory = 'all';
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-cat="all"]').classList.add('active');
  fetchProducts();
}
// ─── Init ─────────────────────────────────────────────────────────────────
(async function init() {
  applyURLParams();
  updateCartUI();
  await Promise.all([fetchCategories(), fetchProducts()]);
})();
