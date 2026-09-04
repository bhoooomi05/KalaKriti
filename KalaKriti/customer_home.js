// ================== STATE MANAGEMENT ==================
let cart = [];
let wishlist = [];
let registeredWorkshops = [];
let currentWorkshopForPayment = null; // holds workshop object when paying for workshop enrollment
let allProducts = [];
let allWorkshops = [];
let currentUserEmail = null;

// Get user email from session storage
function getUserEmail() {
  if (!currentUserEmail) {
    const userInfo = sessionStorage.getItem('userInfo');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      currentUserEmail = user.email || user.username;
    }
  }
  return currentUserEmail;
}

// Open payment modal for a workshop enrollment
function openWorkshopPayment(workshopId, title) {
    const paymentModal = document.getElementById('paymentModal');
    if (!paymentModal) return;
    // find workshop object
    const wk = allWorkshops.find(w => w.id === workshopId) || { id: workshopId, title: title };
    currentWorkshopForPayment = wk;
    paymentModal.style.display = 'flex';
    displayOrderSummary();
}

// --- Persistence keys
const STORAGE_KEYS = {
    registeredWorkshops: 'rk_registered_workshops',
    receipts: 'rk_payment_receipts'
};

// ================== UI HELPERS ==================
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'rk-toast rk-toast-' + type;
    toast.textContent = message;
    toast.style.cssText = 'position:fixed; right:1.25rem; bottom:1.25rem; background:rgba(0,0,0,0.85); color:white; padding:10px 14px; border-radius:10px; z-index:2000; box-shadow:0 6px 18px rgba(0,0,0,0.2); font-weight:600;';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

function showProcessingOverlay(show, text = 'Processing...') {
    let overlay = document.getElementById('rkProcessingOverlay');
    if (show) {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'rkProcessingOverlay';
            overlay.style.cssText = 'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:3000;';
            overlay.innerHTML = `<div style="background:white; padding:18px 22px; border-radius:12px; display:flex; gap:12px; align-items:center; box-shadow:0 10px 40px rgba(0,0,0,0.25);"><div class=\"rk-spinner\" style=\"width:28px;height:28px;border:4px solid #eee;border-top-color:#D2794D;border-radius:50%;animation:rkSpin 1s linear infinite;\"></div><div style=\"font-weight:700;color:#333;\">${text}</div></div>`;
            document.body.appendChild(overlay);
            const style = document.createElement('style');
            style.id = 'rk-spinner-style';
            style.textContent = '@keyframes rkSpin{to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
    } else {
        if (overlay) overlay.remove();
        const style = document.getElementById('rk-spinner-style');
        if (style) style.remove();
    }
}

function saveRegisteredWorkshopsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.registeredWorkshops, JSON.stringify(registeredWorkshops));
    } catch (e) { /* ignore storage errors */ }
}

function loadRegisteredWorkshopsFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.registeredWorkshops);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) registeredWorkshops = parsed;
        }
    } catch (e) { /* ignore */ }
}

function saveReceiptToStorage(receipt) {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.receipts);
        const arr = raw ? JSON.parse(raw) : [];
        arr.push(receipt);
        localStorage.setItem(STORAGE_KEYS.receipts, JSON.stringify(arr));
    } catch (e) { }
}

// Luhn algorithm for card validation
function luhnCheck(ccNum) {
    const s = ccNum.replace(/\D/g, '');
    let sum = 0, shouldDouble = false;
    for (let i = s.length - 1; i >= 0; i--) {
        let digit = parseInt(s.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

function isExpiryValid(expiry) {
    // expiry in MM/YY
    if (!expiry || !/^[0-1][0-9]\/\d{2}$/.test(expiry)) return false;
    const [m, y] = expiry.split('/').map(s => parseInt(s, 10));
    if (m < 1 || m > 12) return false;
    const fullYear = 2000 + y;
    const now = new Date();
    const expDate = new Date(fullYear, m, 1); // first day of next month
    return expDate > now;
}

// ================== INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', () => {
    // Load products from backend
    fetch('http://127.0.0.1:5000/products')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allProducts = data.products;
                displayProducts(allProducts);
            }
        })
        .catch(err => console.error('Error loading products:', err));

    // Load workshops from backend
    fetch('http://127.0.0.1:5000/workshops')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                allWorkshops = data.workshops;
                loadWorkshops();
            }
        })
        .catch(err => console.error('Error loading workshops:', err));

    loadRegisteredWorkshopsFromStorage();
    loadSellers(); 
    updateCart();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('keyup', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300);
        });
    }
});

// ensure profile counters update if registrations were loaded
document.addEventListener('DOMContentLoaded', () => {
        const profileMenuBtn = document.querySelector('.profile-icon');
        if (profileMenuBtn) {
                // no-op but keeps consistency; loadProfileDetails reads registeredWorkshops length when opened
        }
});

// ================== UTILITIES & HELPERS ==================
function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

function openSellModal() {
    const modal = document.getElementById('sellModal');
    if (modal) modal.style.display = 'flex';
}

function playStories() {
    // Open curated artisan story in a new tab
    window.open('https://youtu.be/ued101wGvDM?si=QfsRhQYG9nir4qUA', '_blank');
}

// ================== PROFILE FUNCTIONALITY ==================
function toggleProfile(e) {
    if (e) e.preventDefault();
    const profileDropdown = document.getElementById('profileDropdown');
    const cartSidebar = document.getElementById('cartSidebar');

    if (profileDropdown && cartSidebar) {
        profileDropdown.classList.toggle('active');
        cartSidebar.classList.remove('active');
        
        if (profileDropdown.classList.contains('active')) {
            loadProfileDetails();
        }
    }
}

function loadProfileDetails() {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar"><i class="fas fa-user-circle"></i></div>
            <div class="profile-info">
                <h3>Welcome Back!</h3>
                <p>Explore & Shop</p>
            </div>
            <button class="close-profile" onclick="closeProfile()">&times;</button>
        </div>
        <ul class="profile-menu">
            <li onclick="openProfileSettings()"><i class="fas fa-user-edit"></i> Edit Profile</li>
            <li onclick="viewOrders()"><i class="fas fa-box"></i> My Orders</li>
            <li onclick="viewWishlist()"><i class="fas fa-heart"></i> Wishlist (${wishlist.length})</li>
            <li onclick="viewRegisteredWorkshops()"><i class="fas fa-calendar-check"></i> My Workshops (${registeredWorkshops.length})</li>
            <li onclick="logout()" class="logout-option"><i class="fas fa-sign-out-alt"></i> Logout</li>
        </ul>
    `;
}

function closeProfile() {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) dropdown.classList.remove('active');
}

function openProfileSettings() {
    closeProfile();
    const modal = document.getElementById('profileModal');
    if (modal) modal.style.display = 'flex';
}

function saveProfile(e) {
    e.preventDefault();
    closeModal('profileModal');
    e.target.reset();
}

function logout() {
    // Provide a consistent logout: clear client-side session data and redirect to login
    if (!confirm('Are you sure you want to log out?')) return;

    // Close any open UI
    try { closeProfile(); } catch (e) { }

    // Clear in-memory state
    cart = [];
    wishlist = [];
    registeredWorkshops = [];
    updateCart();

    // Clear storage that represents the logged-in user
    try {
        sessionStorage.removeItem('userInfo');
        // optionally clear any app-specific items
        localStorage.removeItem(STORAGE_KEYS.registeredWorkshops);
    } catch (e) { }

    // Redirect back to login page (preserve host/path)
    try {
        window.location.href = 'login.html';
    } catch (e) {
        // fallback: reload page
        window.location.reload();
    }
}

function viewOrders() {
    closeProfile();
}

function viewWishlist() {
    closeProfile();
}

function viewRegisteredWorkshops() {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;

    // Ensure the dropdown is visible
    dropdown.classList.add('active');

    // Build content: header + list (or empty state) + back button
    let html = `
        <div class="profile-header">
            <div class="profile-avatar"><i class="fas fa-user-circle"></i></div>
            <div class="profile-info">
                <h3>My Workshops</h3>
                <p>Your registered workshops</p>
            </div>
            <button class="close-profile" onclick="closeProfile()">&times;</button>
        </div>
    `;

    if (!registeredWorkshops || registeredWorkshops.length === 0) {
        html += `<div style="padding:1rem; font-style:italic; color:#666;">You have not registered for any workshops yet.</div>`;
    } else {
        html += `<ul style="list-style:none; padding: 0.75rem; max-height: 260px; overflow:auto; margin:0;">
            ${registeredWorkshops.map(w => `
                <li style="padding:0.6rem 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                    <div style="font-weight:700; color:var(--color-dark-bg);">${w.title}</div>
                    <div style="font-size:0.85rem; color:#666;">${w.date} • ${w.instructor}</div>
                </li>
            `).join('')}
        </ul>`;
    }

    html += `<div style="padding:0.75rem; text-align:center;"><button class="save-btn" onclick="loadProfileDetails()" style="width:100%;">Back</button></div>`;

    dropdown.innerHTML = html;
}

function addToWishlist(productId, button) {
    const index = wishlist.indexOf(productId);
    if (index === -1) {
        wishlist.push(productId);
        button.classList.add('active');
        const icon = button.querySelector('i');
        if (icon) icon.classList.replace('far', 'fas');
    } else {
        wishlist.splice(index, 1);
        button.classList.remove('active');
        const icon = button.querySelector('i');
        if (icon) icon.classList.replace('fas', 'far');
    }
}

// ================== CART FUNCTIONALITY ==================
function toggleCart(e) {
    if (e) e.preventDefault();
    const cartSidebar = document.getElementById('cartSidebar');
    const profileDropdown = document.getElementById('profileDropdown');
    
    if (cartSidebar) cartSidebar.classList.toggle('active');
    if (profileDropdown) profileDropdown.classList.remove('active');
}

function addToCart(product) {
    if (!product || !product.id) return;

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    updateCart();
    // show a small toast so the user knows the item was added
    try {
        showToast((existingItem ? 'Quantity updated in cart' : 'Item added to cart') + ' — ' + product.name, 'success', 2200);
    } catch (e) { }
    const cartSidebar = document.getElementById('cartSidebar');
    if (cartSidebar) cartSidebar.classList.add('active');
}

function updateCart() {
    const cartCountEl = document.getElementById('cartCount');
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');

    if (!cartCountEl || !cartItemsEl || !cartTotalEl) return;

    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCountEl.textContent = totalItems;

    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="empty-cart">Your cart is empty. Start shopping!</p>';
        cartTotalEl.textContent = '₹0';
        return;
    }

    let html = '';
    let total = 0;

    cart.forEach((item, index) => {
        const price = parseInt(item.price) || 999;
        const quantity = item.quantity || 1;
        total += price * quantity;
        
        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/70?text=Art'">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>₹${price.toLocaleString('en-IN')} × ${quantity}</p>
                    <div class="quantity-controls">
                        <button onclick="changeQuantity(${index}, -1)">−</button>
                        <span>${quantity}</span>
                        <button onclick="changeQuantity(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });

    cartItemsEl.innerHTML = html;
    cartTotalEl.textContent = '₹' + total.toLocaleString('en-IN');
}

function changeQuantity(index, delta) {
    if (cart[index]) {
        const newQty = (cart[index].quantity || 1) + delta;
        if (newQty > 0) {
            cart[index].quantity = newQty;
            updateCart();
        } else {
            removeFromCart(index);
        }
    }
}

function removeFromCart(index) {
    if (cart[index]) {
        cart.splice(index, 1);
        updateCart();
    }
}

// ================== PAYMENT GATEWAY ==================
function proceedToCheckout() {
    if (cart.length === 0) return;
    
    const cartSidebar = document.getElementById('cartSidebar');
    const paymentModal = document.getElementById('paymentModal');
    
    if (cartSidebar && paymentModal) {
        cartSidebar.classList.remove('active');
        paymentModal.style.display = 'flex';
        displayOrderSummary();
    }
}

function displayOrderSummary() {
    const summaryEl = document.getElementById('orderSummary');
    if (!summaryEl) return;

    let html = '<div class="order-items">';
    let subtotal = 0;

    if (currentWorkshopForPayment) {
        // Fixed mock fee for workshop enrollment
        const price = 499;
        subtotal = price;
        html += `
            <div class="summary-item">
                <span>Workshop: ${currentWorkshopForPayment.title || 'Workshop'}</span>
                <span>₹${price.toLocaleString('en-IN')}</span>
            </div>
        `;
    } else {
        cart.forEach(item => {
            const price = parseInt(item.price) || 999;
            const qty = item.quantity || 1;
            const itemTotal = price * qty;
            subtotal += itemTotal;

            html += `
                <div class="summary-item">
                    <span>${item.name} (x${qty})</span>
                    <span>₹${itemTotal.toLocaleString('en-IN')}</span>
                </div>
            `;
        });
    }

    const tax = Math.round(subtotal * 0.18);
    const shipping = currentWorkshopForPayment ? 0 : (subtotal > 2000 ? 0 : 150);
    const total = subtotal + tax + shipping;

    html += `
        </div>
        <div class="price-breakdown">
            <div class="breakdown-row"><span>Subtotal:</span> <span>₹${subtotal.toLocaleString('en-IN')}</span></div>
            <div class="breakdown-row"><span>Tax (18%):</span> <span>₹${tax.toLocaleString('en-IN')}</span></div>
            <div class="breakdown-row"><span>Shipping:</span> <span>${shipping === 0 ? 'FREE' : '₹' + shipping}</span></div>
            <div class="breakdown-row total"><span>Total Amount:</span> <span>₹${total.toLocaleString('en-IN')}</span></div>
        </div>
    `;

    summaryEl.innerHTML = html;
    document.getElementById('finalAmount').textContent = '₹' + total.toLocaleString('en-IN');
    renderPaymentMethodForm('upi');
}

function selectPaymentMethod(method, btn) {
    document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPaymentMethodForm(method);
}

function renderPaymentMethodForm(method) {
    const formDiv = document.getElementById('paymentMethodDetails');
    let formHtml = '';

    if (method === 'upi') {
        formHtml = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">UPI ID</label>
                <input type="text" name="upiId" placeholder="yourname@upi" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
            </div>
            <div id="rk-upi-qr" style="display:flex; gap:1rem; align-items:center; margin-top:8px;">
                <div style="width:120px; height:120px; border:6px solid #f5f5f5; border-radius:8px; display:flex; align-items:center; justify-content:center; background:white;">
                    <img id="rk-upi-qr-img" src="" alt="UPI QR" style="max-width:100%; max-height:100%; object-fit:contain;" />
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700; margin-bottom:6px;">Scan to pay (demo)</div>
                    <div style="color:#666; font-size:0.9rem; margin-bottom:8px;">Use any UPI app to scan or copy UPI ID below.</div>
                    <div style="display:flex; gap:8px; align-items:center;"><input id="rk-upi-id-copy" type="text" value="demo@upi" readonly style="padding:8px; border:1px solid #ddd; border-radius:6px; width:60%;" /><button type="button" onclick="copyText('#rk-upi-id-copy')" style="padding:8px 10px; background:#D2794D; color:#fff; border:none; border-radius:6px; cursor:pointer;">Copy UPI</button></div>
                    <div style="margin-top:8px;"><button type="button" onclick="generateDummyUPIQR()" style="padding:8px 10px; background:#2196F3; color:#fff; border:none; border-radius:6px; cursor:pointer;">Generate QR</button></div>
                </div>
            </div>
        `;
    } else if (method === 'card') {
        formHtml = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Card Number</label>
                <input type="text" name="cardNumber" placeholder="1234 5678 9012 3456" maxlength="19" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Expiry</label>
                    <input type="text" name="expiry" placeholder="MM/YY" maxlength="5" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">CVV</label>
                    <input type="text" name="cvv" placeholder="123" maxlength="3" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
                </div>
            </div>
        `;
    } else if (method === 'netbanking') {
        formHtml = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Select Bank</label>
                <select name="bank" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
                    <option value="">Choose a bank</option>
                    <option value="sbi">State Bank of India</option>
                    <option value="hdfc">HDFC Bank</option>
                    <option value="icici">ICICI Bank</option>
                    <option value="axis">Axis Bank</option>
                </select>
            </div>
        `;
    } else if (method === 'wallet') {
        formHtml = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Select Wallet</label>
                <select name="wallet" style="width: 100%; padding: 12px; border: 2px solid #D2794D; border-radius: 8px; font-size: 1rem;">
                    <option value="">Choose a wallet</option>
                    <option value="googlepay">Google Pay</option>
                    <option value="paytm">Paytm</option>
                    <option value="phonepe">PhonePe</option>
                </select>
            </div>
            <div id="rk-wallet-qr" style="display:flex; gap:1rem; align-items:center; margin-top:8px;">
                <div style="width:120px; height:120px; border:6px solid #f5f5f5; border-radius:8px; display:flex; align-items:center; justify-content:center; background:white;">
                    <img id="rk-wallet-qr-img" src="" alt="Wallet QR" style="max-width:100%; max-height:100%; object-fit:contain;" />
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700; margin-bottom:6px;">Scan to pay with wallet (demo)</div>
                    <div style="color:#666; font-size:0.9rem; margin-bottom:8px;">Generate demo QR for quick testing.</div>
                    <div><button type="button" onclick="generateDummyWalletQR()" style="padding:8px 10px; background:#4CAF50; color:#fff; border:none; border-radius:6px; cursor:pointer;">Generate Wallet QR</button></div>
                </div>
            </div>
        `;
    }

    formDiv.innerHTML = formHtml;
}

// copy helper
function copyText(selectorOrEl) {
    try {
        let el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
        if (!el) return;
        el.select ? el.select() : null;
        const val = el.value || el.textContent || '';
        navigator.clipboard.writeText(val).then(() => {
            showToast('Copied to clipboard', 'success', 1800);
        }).catch(() => {
            showToast('Copy failed', 'error', 1800);
        });
    } catch (e) { showToast('Copy not supported', 'error', 1800); }
}

function generateDummyUPIQR() {
    const upi = 'upi://pay?pa=demo@upi&pn=KalaKriti&am=1';
    const svg = buildSimpleQRSVG(upi);
    const img = document.getElementById('rk-upi-qr-img');
    if (img) img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function generateDummyWalletQR() {
    const payload = 'wallet://pay?wallet=demo-wallet&am=1';
    const svg = buildSimpleQRSVG(payload);
    const img = document.getElementById('rk-wallet-qr-img');
    if (img) img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Improved pseudo-QR SVG generator for demo visuals only (not a real QR encoder)
function buildSimpleQRSVG(text) {
    // generate a deterministic pseudo-random matrix from the text
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed = (seed * 1315423911 + text.charCodeAt(i)) >>> 0;

    function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xFFFFFFFF; }

    const modules = 29; // make it denser (29x29 is similar to QR versions)
    const size = 260;
    const margin = 8;
    const cell = Math.floor((size - margin * 2) / modules);
    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet" style="background:white">`);

    // background white
    svgParts.push(`<rect width="100%" height="100%" fill="#fff"/>`);

    // helper to draw module
    function draw(x, y) {
        const px = margin + x * cell;
        const py = margin + y * cell;
        svgParts.push(`<rect x="${px}" y="${py}" width="${cell}" height="${cell}" fill="#111"/>`);
    }

    // draw finder patterns (top-left, top-right, bottom-left)
    function drawFinder(sx, sy) {
        const outer = 7;
        for (let y = 0; y < outer; y++) {
            for (let x = 0; x < outer; x++) {
                const dx = sx + x;
                const dy = sy + y;
                const border = (x === 0 || y === 0 || x === outer - 1 || y === outer - 1);
                const inner = (x >= 2 && x <= 4 && y >= 2 && y <= 4);
                if (border || inner) draw(dx, dy);
            }
        }
    }

    drawFinder(0, 0);
    drawFinder(modules - 7, 0);
    drawFinder(0, modules - 7);

    // timing patterns (horizontal and vertical)
    for (let i = 8; i < modules - 8; i++) {
        if (i % 2 === 0) draw(i, 6);
        if (i % 2 === 0) draw(6, i);
    }

    // fill remaining modules pseudo-randomly but avoid finder & timing zones
    for (let y = 0; y < modules; y++) {
        for (let x = 0; x < modules; x++) {
            // skip areas
            const inFinderTL = x < 9 && y < 9;
            const inFinderTR = x > modules - 10 && y < 9;
            const inFinderBL = x < 9 && y > modules - 10;
            const inTiming = (x === 6 || y === 6);
            if (inFinderTL || inFinderTR || inFinderBL || inTiming) continue;

            // deterministic randomness
            const v = rand();
            if (v > 0.55) draw(x, y);
        }
    }

    // tiny annotation (center text) to indicate it's demo/encoded text
    svgParts.push(`<text x="${size / 2}" y="${size - 6}" font-size="9" text-anchor="middle" fill="#666">demo:${(text || '').slice(0,20)}</text>`);

    svgParts.push(`</svg>`);
    return svgParts.join('');
}

function processPayment(e) {
    e.preventDefault();
    
    const selectedMethod = document.querySelector('.payment-method-btn.active');
    if (!selectedMethod) return;

    const method = selectedMethod.dataset.method;
    const formData = new FormData(document.getElementById('paymentForm'));
    
    if (!validatePaymentForm(method, formData)) return;

    const submitBtn = document.querySelector('#paymentForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    // show overlay
    showProcessingOverlay(true, 'Processing payment...');

    // Simulate processing and a chance of failure (10%)
    setTimeout(() => {
        const fail = Math.random() < 0.10; // 10% simulated failure
        showProcessingOverlay(false);
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Pay <span id="finalAmount">' + document.getElementById('finalAmount').textContent + '</span>';

        if (fail) {
            showToast('Payment failed. Please try another method or card.', 'error', 4500);
        } else {
            // Build a small receipt and store it
            const receipt = {
                id: 'RCPT' + Date.now(),
                amount: document.getElementById('finalAmount').textContent,
                method,
                date: new Date().toLocaleString(),
                items: currentWorkshopForPayment ? [{ id: currentWorkshopForPayment.id, name: currentWorkshopForPayment.title || 'Workshop', qty: 1, price: 499 }] : cart.map(i => ({ id: i.id, name: i.name, qty: i.quantity || 1, price: i.price }))
            };
            saveReceiptToStorage(receipt);
            completePayment(method, receipt);
        }
    }, 1600);
}

function validatePaymentForm(method, formData) {
    if (method === 'upi') {
        const upiId = formData.get('upiId') || '';
        const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
        if (!upiRegex.test(upiId)) {
            alert('Invalid UPI ID format (e.g., name@bankname)');
            return false;
        }
    } else if (method === 'card') {
        const cardNo = (formData.get('cardNumber') || '').replace(/\s/g, '');
        const cvv = formData.get('cvv') || '';
        const expiry = formData.get('expiry') || '';
        if (cardNo.length !== 16 || !/^\d{16}$/.test(cardNo)) {
            alert('Card number must be 16 digits');
            return false;
        }
        if (!luhnCheck(cardNo)) {
            alert('Invalid card number (failed checksum).');
            return false;
        }
        if (!isExpiryValid(expiry)) {
            alert('Card expiry is invalid or expired.');
            return false;
        }
        if (cvv.length !== 3 || !/^\d{3}$/.test(cvv)) {
            alert('CVV must be 3 digits');
            return false;
        }
    } else if (method === 'netbanking') {
        const bank = formData.get('bank') || '';
        if (!bank) {
            alert('Please select a bank');
            return false;
        }
    } else if (method === 'wallet') {
        const wallet = formData.get('wallet') || '';
        if (!wallet) {
            alert('Please select a wallet');
            return false;
        }
    }
    return true;
}

function completePayment(method, receipt) {
    const methodNames = {
        'upi': 'UPI',
        'card': 'Card',
        'netbanking': 'Net Banking',
        'wallet': 'Digital Wallet'
    };

    const total = receipt ? receipt.amount : document.getElementById('finalAmount').textContent;
    const transactionId = receipt ? receipt.id : ('TXN' + Date.now());

    // friendly non-blocking confirmation
    showToast('Payment successful — ' + transactionId, 'success', 4000);

    // show a lightweight receipt modal inside the site (simple)
    const modal = document.getElementById('paymentModal');
    if (modal) closeModal('paymentModal');

    if (currentWorkshopForPayment) {
        // enroll to workshop after successful payment
        try {
            enrollWorkshop(currentWorkshopForPayment.id, currentWorkshopForPayment.title || 'Workshop');
        } catch (e) { }
        currentWorkshopForPayment = null;
    } else {
        // clear cart and update
        cart = [];
        updateCart();
    }

    const form = document.getElementById('paymentForm');
    if (form) form.reset();

    // Save receipt already handled by caller; show a small summary
    setTimeout(() => {
        alert(`Payment Confirmed\n\nReceipt: ${transactionId}\nAmount: ${total}\nMethod: ${methodNames[method]}\n\nThank you for supporting Indian artisans!`);
    }, 500);
}

// ================== DATA RENDERING ==================
function displayProducts(products) {
    const feed = document.getElementById("feed");
    if (!feed) return;
    
    feed.innerHTML = "";

    if (!products || products.length === 0) {
        feed.innerHTML = '<p class="error">No products found.</p>';
        return;
    }

    products.forEach((p) => {
        if (!p || !p.id) return;
        
        const isWishlisted = wishlist.includes(p.id);
        const card = document.createElement("div");
    card.className = "product-card";
    // add id so we can scroll to a product from artisan profile
    card.id = 'product-' + p.id;
        card.dataset.category = p.category || '';

        card.innerHTML = `
            <img src="${p.image_url || p.image || 'https://via.placeholder.com/300x250'}" alt="${p.name}" onclick="openProductInNewTab(${p.id})" style="cursor: pointer;">
            <h2 onclick="openProductInNewTab(${p.id})" style="cursor: pointer;">${p.name}</h2>
            <div class="product-desc">${p.description || ''}</div>
            <div class="product-price">₹${(p.price || 0).toLocaleString('en-IN')}</div>
            <div class="product-actions">
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="addToWishlist(${p.id}, this)">
                    <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
                </button>
                <button class="order-btn" onclick="addToCart({id: ${p.id}, name: '${p.name.replace(/'/g, "\\'")}', price: ${p.price}, image: '${p.image_url || p.image}'})">Add to Cart</button>
            </div>
        `;
        feed.appendChild(card);
    });
}

// Scroll to and highlight a product card in the feed
function showProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        // fallback: scroll to card if present
        const el = document.getElementById('product-' + productId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const orig = el.style.boxShadow;
            el.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
            el.style.boxShadow = '0 12px 30px rgba(210,121,77,0.35)';
            el.style.transform = 'translateY(-6px)';
            setTimeout(() => {
                el.style.boxShadow = orig || '';
                el.style.transform = '';
            }, 2000);
        }
        return;
    }

    const modal = document.getElementById('productModal');
    const content = document.getElementById('productDetailContent');
    if (!modal || !content) return;

    // Load reviews for this product
    fetch(`http://127.0.0.1:5000/reviews?product_id=${productId}`)
        .then(res => res.json())
        .then(data => {
            const reviews = data.reviews || [];
            
            content.innerHTML = `
                <h2 style="margin-bottom: 1rem; color: var(--color-primary);">${product.name}</h2>
                
                <div style="display:flex; gap:1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                    <div style="flex: 0 0 200px;">
                        <img src="${product.image_url || product.image}" alt="${product.name}" style="width:100%; height:200px; object-fit:cover; border-radius:12px; border: 3px solid #D2794D;" onerror="this.src='https://via.placeholder.com/200x200?text=Art'" />
                    </div>
                    <div style="flex:1; min-width: 250px;">
                        <div style="font-size: 1.3rem; font-weight:800; color: var(--color-primary); margin-bottom:0.5rem;">
                            ₹${(product.price || 0).toLocaleString('en-IN')}
                        </div>
                        <div style="color:#666; margin-bottom:1rem; line-height:1.6;">
                            ${product.description || 'No description available'}
                        </div>
                        <div style="display:flex; gap:0.6rem; flex-wrap: wrap;">
                            <button class="save-btn" onclick="addToCart({id: ${product.id}, name: '${product.name.replace(/'/g, "\\'")}', price: ${product.price}, image: '${product.image_url || product.image}'}); closeModal('productModal');">
                                <i class="fas fa-cart-plus"></i> Add to Cart
                            </button>
                            <button class="btn-secondary" onclick="openFeedbackModal(${productId})">
                                <i class="fas fa-comment"></i> Feedback
                            </button>
                            <button class="btn-secondary" onclick="window.open('ar-view.html?product_id=${productId}', '_blank')">
                                <i class="fas fa-vr-cardboard"></i> View in AR
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Reviews Section -->
                <div style="border-top: 2px solid #eee; padding-top: 1.5rem; margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">
                        <i class="fas fa-star"></i> Customer Reviews (${reviews.length})
                    </h3>
                    
                    <div id="reviewsContainer" style="max-height: 300px; overflow-y: auto;">
                        ${reviews.length === 0 ? 
                            '<p style="color: #999; font-style: italic;">No reviews yet. Be the first to review!</p>' :
                            reviews.map(r => `
                                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                        <strong>${r.rating}⭐ ${r.customer_email || 'Anonymous'}</strong>
                                    </div>
                                    <p style="margin: 0;">${r.text}</p>
                                </div>
                            `).join('')
                        }
                    </div>

                    <!-- Leave Review Section -->
                    <div style="margin-top: 1.5rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                        <h4 style="margin-bottom: 0.5rem;">Leave a Review</h4>
                        <form onsubmit="submitReview(event, ${productId})">
                            <div style="margin-bottom: 0.5rem;">
                                <label>Rating: </label>
                                <select id="reviewRating_${productId}" style="padding: 5px; border: 1px solid #ddd; border-radius: 4px;" required>
                                    <option value="">Select</option>
                                    <option value="5">5 ⭐</option>
                                    <option value="4">4 ⭐</option>
                                    <option value="3">3 ⭐</option>
                                    <option value="2">2 ⭐</option>
                                    <option value="1">1 ⭐</option>
                                </select>
                            </div>
                            <textarea id="reviewText_${productId}" placeholder="Write your review..." required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem;" rows="3"></textarea>
                            <input type="email" id="reviewEmail_${productId}" placeholder="Your email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.5rem;">
                            <button type="submit" class="save-btn" style="width: 100%;">Submit Review</button>
                        </form>
                    </div>
                </div>
            `;
            
            modal.style.display = 'flex';
        })
        .catch(err => {
            console.error('Error loading reviews:', err);
            alert('Error loading product details');
        });
}

function submitReview(event, productId) {
    event.preventDefault();
    const rating = document.getElementById(`reviewRating_${productId}`).value;
    const text = document.getElementById(`reviewText_${productId}`).value;
    const email = document.getElementById(`reviewEmail_${productId}`).value;
    
    fetch('http://127.0.0.1:5000/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product_id: productId,
            rating: rating,
            text: text,
            customer_email: email
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message);
        if (data.success) {
            // Refresh product details
            showProduct(productId);
        }
    });
}

function openFeedbackModal(productId) {
    document.getElementById('feedbackProductId').value = productId;
    document.getElementById('feedbackModal').style.display = 'flex';
}

// Submit product rating
function submitRating(productId, rating, reviewText) {
    const userEmail = getUserEmail();
    if (!userEmail) {
        showToast('Please login to rate products', 'error', 2500);
        return;
    }
    
    fetch('http://127.0.0.1:5000/products/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product_id: productId,
            customer_email: userEmail,
            rating: rating,
            review_text: reviewText || ''
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Rating submitted successfully!', 'success', 3000);
        } else {
            showToast(data.message, 'error', 3000);
        }
    })
    .catch(err => {
        console.error('Rating error:', err);
        showToast('Failed to submit rating', 'error', 3000);
    });
}

// Get product ratings
function getProductRatings(productId) {
    return fetch(`http://127.0.0.1:5000/products/ratings?product_id=${productId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                return data.ratings;
            }
            return [];
        })
        .catch(err => {
            console.error('Error fetching ratings:', err);
            return [];
        });
}

function openProductInNewTab(productId) {
    // Store product data in sessionStorage and open product detail page
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        sessionStorage.setItem('currentProduct', JSON.stringify(product));
        window.open('product-detail.html', '_blank');
    }
}

function openWorkshopInNewTab(workshopId, title) {
    // Store workshop data and open in new tab
    const workshop = allWorkshops.find(w => w.id === workshopId);
    if (workshop) {
        sessionStorage.setItem('currentWorkshop', JSON.stringify(workshop));
        window.open('workshop-detail.html', '_blank');
    }
}

function loadWorkshops() {
    const grid = document.getElementById("workshopsGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    
    allWorkshops.forEach(w => {
        if (!w || !w.id) return;
        
        const isRegistered = registeredWorkshops.some(rw => rw.id === w.id);
        const card = document.createElement("div");
        card.className = "workshop-card";
        
    // Use the image URL from API (preferred) or construct from filename
    const imageUrl = w.image_url || (w.image ? `http://127.0.0.1:5000/uploads/${w.image}` : '');

        // Seats remaining mock/real values
        const totalSeats = (w.max_participants && parseInt(w.max_participants)) ? parseInt(w.max_participants) : 24;
        const takenSeats = Math.min(totalSeats - 1, (w.id * 7) % totalSeats);
        const remainingSeats = Math.max(0, totalSeats - takenSeats);
        const fillPct = Math.max(0, Math.min(100, Math.round((takenSeats / totalSeats) * 100)));

        // Build simple seat diagram (small circles)
        const seatCircles = Array.from({ length: Math.min(totalSeats, 12) }).map((_, idx) => {
            const filled = idx < Math.round((takenSeats / totalSeats) * Math.min(totalSeats, 12));
            return `<span style="width:10px;height:10px;border-radius:50%;display:inline-block;margin:0 2px;${filled ? 'background:#4CAF50;' : 'background:#ddd;'}"></span>`;
        }).join('');

        card.innerHTML = `
            <div style="position: relative; overflow: hidden; border-radius: 12px 12px 0 0; height: 200px; display:flex; align-items:center; justify-content:center; background: linear-gradient(135deg, #D2794D, #B55D36); cursor: pointer;" 
                 onclick="openWorkshopInNewTab(${w.id}, '${w.title.replace(/'/g, "\\'")}')">
                ${imageUrl ? `<img src="${imageUrl}" alt="${w.title}" style="width:100%; height:100%; object-fit:cover;" />` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;"><i class="fas fa-chalkboard-teacher"></i></div>`}
            </div>
            <div style="padding: 1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap: 0.75rem;">
                    <h3 style="margin:0; font-size:1.1rem; color: var(--color-primary);">${w.title}</h3>
                    <span style="font-size:0.8rem; color:#666;">${w.date}</span>
                </div>
                <p style="color:#666; margin: 6px 0 10px;">${w.description || ''}</p>
                <div style="margin:8px 0 10px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem; color:#555; margin-bottom:6px;">
                        <span><i class="fas fa-users"></i> Seats: ${totalSeats}</span>
                        <span style="font-weight:700; color:${remainingSeats <= 3 ? '#d32f2f' : '#4CAF50'}">${remainingSeats} left</span>
                    </div>
                    <div style="height:8px; background:#eee; border-radius:999px; overflow:hidden;">
                        <div style="width:${fillPct}%; height:100%; background:linear-gradient(90deg,#FFB74D,#D2794D);"></div>
                    </div>
                    <div style="margin-top:6px; text-align:center;">${seatCircles}</div>
                </div>
                <div style="display:flex; gap: 0.6rem;">
                    ${isRegistered ? 
                        `<button style="flex:1; padding: 8px; border-radius: 20px; border: none; font-size: 0.85rem; background: #4CAF50; color: white; cursor: default;">
                            <i class="fas fa-check-circle"></i> Registered
                        </button>` :
                        `<button style="flex:1; padding: 8px; border-radius: 20px; border: none; font-size: 0.85rem; background: var(--color-primary); color: white; cursor: pointer;" onclick="openWorkshopPayment(${w.id}, '${w.title.replace(/'/g, "\\'")}')">
                            Enroll Now
                        </button>`
                    }
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function enrollWorkshop(id, title) {
    const alreadyRegistered = registeredWorkshops.some(w => w.id === id);
    
    if (alreadyRegistered) {
        showToast('You are already registered for this workshop', 'info', 2500);
        return;
    }
    
    // Get user email
    const userEmail = getUserEmail();
    if (!userEmail) {
        showToast('Please login to enroll in workshops', 'error', 2500);
        return;
    }
    
    // Call API to enroll
    fetch('http://127.0.0.1:5000/workshops/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            workshop_id: id,
            customer_email: userEmail
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const workshop = allWorkshops.find(w => w.id === id);
            if (workshop) {
                registeredWorkshops.push(workshop);
                saveRegisteredWorkshopsToStorage();
                loadWorkshops();
                showToast(`Enrolled: ${title}`, 'success', 3000);
                
                const dropdown = document.getElementById('profileDropdown');
                if (dropdown) {
                    dropdown.classList.add('active');
                    viewRegisteredWorkshops();
                }
            }
        } else {
            showToast(data.message, 'error', 3000);
        }
    })
    .catch(err => {
        console.error('Enrollment error:', err);
        showToast('Failed to enroll. Please try again.', 'error', 3000);
    });
}

function loadSellers() {
    const grid = document.getElementById("sellersGrid");
    if (!grid) return;
    
    const render = (sellers) => {
        grid.innerHTML = '';
        if (!sellers || sellers.length === 0) {
            grid.innerHTML = '<p class="error">No KalaKars found.</p>';
            return;
        }
        sellers.forEach(seller => {
            const card = document.createElement("div");
            card.className = "resource-card seller-card";
            card.style.cursor = 'default';
            const name = seller.name || seller.full_name || seller.username || 'KalaKar';
            const email = seller.email || '';
            const cities = ['Delhi', 'Mumbai'];
            const city = cities[Math.floor(Math.random() * cities.length)];
            const specs = ['Madhubani Painting', 'Blue Pottery', 'Warli Art', 'Chikankari Textiles', 'Terracotta Sculpting', 'Brass Handicraft'];
            const speciality = specs[Math.floor(Math.random() * specs.length)];
            card.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px; align-items:center; padding:12px;">
                    <i class="fas fa-user" style="font-size: 1.8rem; color: var(--color-primary);"></i>
                    <h3 style="margin: 0; font-size: 1.1rem;">${name}</h3>
                    <div style="color:#777; font-size:0.9rem;"><i class="fas fa-map-marker-alt"></i> ${city}</div>
                    <div style="color:#555; font-size:0.9rem;">${speciality}</div>
                    <div style="color:#333; font-size:0.9rem;">${email}</div>
                </div>
            `;
            grid.appendChild(card);
        });
    };

    const tryEndpoints = async () => {
        const endpoints = [
  '/agents',
  '/users?role=agent',
  '/kalakars'
];
        for (const url of endpoints) {
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data && (data.success || Array.isArray(data))) {
                    const list = Array.isArray(data) ? data : (data.agents || data.users || data.kalakars || []);
                    if (list.length) { render(list); return; }
                }
            } catch (e) { /* try next */ }
        }
        // Fallback: minimal static, text-only
        render([
            { name: 'Ramesh Kumar' },
            { name: 'Lakshmi Devi' },
            { name: 'Arjun Singh' },
            { name: 'Priya Sharma' }
        ]);
    };

    tryEndpoints();
}

function viewSellerProfile(seller) {
    const modal = document.getElementById('artisanModal');
    const content = document.getElementById('artisanProfileContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div style="width: 120px; height: 120px; margin: 0 auto 1.5rem; border-radius: 50%; overflow: hidden; border: 4px solid var(--color-primary);">
                <img src="${seller.image}" alt="${seller.name}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            <h2 style="color: var(--color-primary); margin-bottom: 0.5rem;">${seller.name}</h2>
            <p style="color: #666; font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: 600;">${seller.speciality}</p>
            <p style="color: #999; margin-bottom: 1rem;"><i class="fas fa-map-marker-alt"></i> ${seller.location}</p>
            <div style="background: #f5f5f5; padding: 1.5rem; border-radius: 12px; margin: 1.5rem 0; text-align: left;">
                <h3 style="margin-bottom: 1rem; color: var(--color-primary);">About This Artisan</h3>
                <p style="color: #666; line-height: 1.6;">With over 15 years of experience, ${seller.name} specializes in ${seller.speciality}. Their work represents the finest traditions of Indian craftsmanship, blending heritage techniques with contemporary designs.</p>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center; margin: 1.5rem 0;">
                <button onclick="showProduct(${seller.productId || 0})" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 20px; cursor: pointer; font-weight: 600;">View Products</button>
            </div>
            <p style="color: gold; font-size: 1.3rem; margin-top: 1rem;">
                <i class="fas fa-star"></i> ${seller.rating} Rating
            </p>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function openResource(type) {
    const resources = {
        'blog': ['Craft Blog', 'https://www.craftcouncil.org/'],
        'guide': ['Handicrafts Guide', 'https://handicrafts.nic.in/'],
        'video': ['Video Tutorials', 'https://www.youtube.com/results?search_query=indian+handicraft'],
        'community': ['Artisan Community', 'https://www.facebook.com/groups/indianhandicrafts']
    };
    
    const [name, url] = resources[type] || ['Resource', '#'];
    setTimeout(() => window.open(url, '_blank'), 300);
}

// ================== SEARCH AND FILTER ==================
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        displayProducts(allProducts);
        return;
    }
    
    const filtered = allProducts.filter(p =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        ((p.category || '').toLowerCase().includes(query))
    );
    
    displayProducts(filtered);
}

function filterProducts(category, button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (button) button.classList.add('active');

    const filtered = category === 'all' ? allProducts : allProducts.filter(p => p.category === category);
    displayProducts(filtered);
}

// ================== FOOTER ACTIONS ==================
function openPage(page) {
    const messages = {
        'about': 'About: Connecting artisans with buyers',
        'contact': 'Contact: support@kalakriti.com',
        'faq': 'FAQ: Shipping, Returns, Tracking',
        'shipping': 'Free shipping on orders above ₹2000',
        'sell': 'Join 500+ artisans!',
        'workshops': 'Share your craft knowledge',
        'resources': 'Access marketing materials',
        'success': 'Read inspiring success stories'
    };
    alert(messages[page] || 'Loading...');
}

function subscribeNewsletter() {
    const emailInput = document.getElementById('newsletterEmail');
    if (!emailInput) return;
    
    const email = emailInput.value.trim();
    
    if (!email || !email.includes('@')) {
        alert('Enter valid email');
        return;
    }
    
    alert('Subscribed successfully!');
    emailInput.value = '';
}

function registerSeller(e) {
    e.preventDefault();
    closeModal('sellModal');
    alert('Your application has been submitted! We will review it and get back to you soon.');
    e.target.reset();
}

// ================== MESSAGE LISTENER FOR NEW TABS ==================
window.addEventListener('message', function(event) {
    if (event.data.type === 'addToCart' && event.data.product) {
        addToCart(event.data.product);
    }
    if (event.data.type === 'enrollWorkshop' && event.data.workshop) {
        const id = event.data.workshop.id;
        const title = event.data.workshop.title;
        enrollWorkshop(id, title);
    }
});

// ================== EVENT LISTENERS ==================
document.addEventListener('click', function(e) {
    const cartSidebar = document.getElementById('cartSidebar');
    const profileDropdown = document.getElementById('profileDropdown');
    const cartIcon = document.querySelector('.cart-icon');
    const profileIcon = document.querySelector('.profile-icon');
    
    if (cartSidebar && cartIcon && cartSidebar.classList.contains('active') && 
        !cartSidebar.contains(e.target) && !cartIcon.contains(e.target)) {
        cartSidebar.classList.remove('active');
    }
    
    if (profileDropdown && profileIcon && profileDropdown.classList.contains('active') && 
        !profileDropdown.contains(e.target) && !profileIcon.contains(e.target)) {
        profileDropdown.classList.remove('active');
    }
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (href) {
            scrollToSection(href.substring(1));
        }
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const cartSidebar = document.getElementById('cartSidebar');
        const profileDropdown = document.getElementById('profileDropdown');
        
        if (cartSidebar) cartSidebar.classList.remove('active');
        if (profileDropdown) profileDropdown.classList.remove('active');
        
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal) modal.style.display = 'none';
        });
    }
    
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.focus();
    }
});

// ================== SCROLL TO TOP BUTTON ==================
let scrollBtn;
window.addEventListener('scroll', function() {
    if (!scrollBtn) {
        scrollBtn = document.createElement('button');
        scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        scrollBtn.style.cssText = `position: fixed; bottom: 80px; right: 1.5rem; width: 45px; height: 45px; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: white; border: none; border-radius: 50%; font-size: 1.1rem; cursor: pointer; opacity: 0; transition: all 0.3s; z-index: 999; box-shadow: 0 4px 15px rgba(210, 121, 77, 0.4);`;
        scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.appendChild(scrollBtn);
    }
    
    scrollBtn.style.opacity = window.scrollY > 300 ? '1' : '0';
    scrollBtn.style.pointerEvents = window.scrollY > 300 ? 'auto' : 'none';
});

console.log('%c🎨 KalaKriti - From Our Roots To Your Home 🎨', 'color: #D2794D; font-size: 20px; font-weight: bold;');