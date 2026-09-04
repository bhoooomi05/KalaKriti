// ==================== STATE MANAGEMENT ====================
let currentAgentEmail = null;

// Get agent email from session storage
function getAgentEmail() {
  if (!currentAgentEmail) {
    const userInfo = sessionStorage.getItem('userInfo');
    if (userInfo) {
      const user = JSON.parse(userInfo);
      currentAgentEmail = user.email || user.username;
    } else {
      currentAgentEmail = "agent@example.com"; // Fallback
    }
  }
  return currentAgentEmail;
}

// ==================== DASHBOARD ANALYTICS ====================
function loadDashboardAnalytics() {
  const agentEmail = getAgentEmail();
  // Use single summary endpoint to fetch counts + revenue
  fetch(`http://127.0.0.1:5000/agent/dashboard-summary?agent_email=${encodeURIComponent(agentEmail)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        updateAnalyticsCard('products', data.products || 0);
        updateAnalyticsCard('workshops', data.workshops || 0);
        updateAnalyticsCard('orders', data.orders || 0);
        updateHeaderStats({ products: data.products || 0, workshops: data.workshops || 0, revenue: data.revenue || 0 });
      }
    })
    .catch(err => console.error('Error loading dashboard summary:', err));
}

// Update the header stat cards (products, workshops, revenue)
function updateHeaderStats({ products, workshops, revenue } = {}) {
  try {
    if (typeof products !== 'undefined') {
      const el = document.getElementById('agentProductCount');
      if (el) el.textContent = products;
    }
    if (typeof workshops !== 'undefined') {
      const el = document.getElementById('agentWorkshopCount');
      if (el) el.textContent = workshops;
    }
    if (typeof revenue !== 'undefined') {
      const el = document.getElementById('agentRevenue');
      if (el) el.textContent = '₹' + (Math.round(revenue) || 0);
    }
  } catch (e) {
    console.error('Error updating header stats', e);
  }
}

function updateAnalyticsCard(type, count) {
  const cardSelectors = {
    'products': '.analytics-card:nth-child(1) .big-number',
    'workshops': '.analytics-card:nth-child(3) .big-number',
    'orders': '.analytics-card:nth-child(2) .big-number'
  };
  
  const selector = cardSelectors[type];
  if (selector) {
    const element = document.querySelector(selector);
    if (element) {
      if (type === 'products' || type === 'workshops') {
        element.textContent = count;
      } else if (type === 'orders') {
        element.textContent = count;
      }
    }
  }
}

// ==================== TOGGLE SECTION ====================
function showSection(id) {
  document.querySelectorAll('.card').forEach(el => el.style.display = 'none');
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';
    // Load data when opening specific sections
    if (id === 'workshops') {
      loadAgentWorkshops();
    } else if (id === 'products') {
      loadAgentProducts();
    }
  }
}

function toggleSection(sectionId) {
  const sections = document.querySelectorAll('[id="products"], [id="workshops"], [id="analytics"], [id="orders"], [id="feedback-section"], [id="ratings-section"]');
  sections.forEach(section => {
    section.style.display = 'none';
  });
  
  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// ==================== LOAD FEEDBACK ====================
function loadFeedback() {
  const feedbackList = document.getElementById('feedbackList');
  if (!feedbackList) return;
  
  const agentEmail = getAgentEmail();
  
  fetch(`http://127.0.0.1:5000/agent/feedback?agent_email=${agentEmail}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const feedback = data.feedback || [];
        
        if (feedback.length === 0) {
          feedbackList.innerHTML = '<p style="color: #999; font-style: italic;">No feedback yet.</p>';
          return;
        }
        
        feedbackList.innerHTML = feedback.map(f => `
          <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong>From: ${f.customer_email}</strong>
              <span style="color: #666; font-size: 0.85rem;">${new Date(f.date_created).toLocaleDateString()}</span>
            </div>
            ${f.product_name ? `<div style="color: var(--primary); margin-bottom: 0.5rem;"><i class="fas fa-box"></i> ${f.product_name}</div>` : ''}
            <p style="margin: 0;">${f.message}</p>
          </div>
        `).join('');
      }
    })
    .catch(err => {
      console.error('Error loading feedback:', err);
      feedbackList.innerHTML = '<p style="color: #999;">Error loading feedback.</p>';
    });
}

// ==================== LOAD RATINGS ====================
function loadRatings() {
  const ratingsList = document.getElementById('ratingsList');
  if (!ratingsList) return;
  
  const agentEmail = getAgentEmail();
  
  fetch(`http://127.0.0.1:5000/agent/product-ratings?agent_email=${agentEmail}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const ratings = data.ratings || [];
        const productStats = data.product_stats || [];
        
        if (ratings.length === 0) {
          ratingsList.innerHTML = '<p style="color: #999; font-style: italic;">No ratings yet.</p>';
          return;
        }
        
        let html = '<h3 style="margin-bottom: 1rem;">Rating Summary by Product</h3>';
        
        if (productStats.length > 0) {
          html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem;">';
          productStats.forEach(stat => {
            html += `
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${stat.name}</h4>
                <div style="font-size: 2rem; font-weight: 700; margin: 0.5rem 0;">
                  ${stat.average.toFixed(1)} ⭐
                </div>
                <p style="margin: 0; opacity: 0.9; font-size: 0.9rem;">${stat.count} rating${stat.count !== 1 ? 's' : ''}</p>
              </div>
            `;
          });
          html += '</div>';
        }
        
        html += '<h3 style="margin-bottom: 1rem;">All Ratings</h3>';
        html += ratings.map(r => `
          <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid gold;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong><i class="fas fa-box"></i> ${r.product_name}</strong>
              <div style="color: gold; font-size: 1.2rem;">
                ${'⭐'.repeat(r.rating)} ${r.rating}/5
              </div>
            </div>
            <div style="color: #666; font-size: 0.85rem; margin-bottom: 0.5rem;">
              From: ${r.customer_email} • ${new Date(r.date_rated).toLocaleDateString()}
            </div>
            ${r.review_text ? `<p style="margin: 0; color: #333;">${r.review_text}</p>` : ''}
          </div>
        `).join('');
        
        ratingsList.innerHTML = html;
      }
    })
    .catch(err => {
      console.error('Error loading ratings:', err);
      ratingsList.innerHTML = '<p style="color: #999;">Error loading ratings.</p>';
    });
}

// ==================== TOGGLE FORM ====================
function toggleForm(btn) {
  const card = btn.closest('.card');
  if (!card) return;
  
  const container = card.querySelector('.form-container');
  if (container) {
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
  }
}

// ==================== CLOSE MODAL ====================
function closeModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('show');
}

// ==================== PROFILE BUTTON (IDs aligned with agent_home.html) ====================
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
const profileModal = document.getElementById('profileModal');

if (profileBtn && profileDropdown) {
  profileBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    profileDropdown.classList.toggle('active');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (
      profileBtn && profileDropdown &&
      !profileBtn.contains(e.target) &&
      !profileDropdown.contains(e.target)
    ) {
      profileDropdown.classList.remove('active');
    }
  });
}

// Edit Profile link inside dropdown
const editProfileLink = document.getElementById('editProfileLink');
if (editProfileLink && profileModal && profileDropdown) {
  editProfileLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    profileModal.classList.add('show');
    profileDropdown.classList.remove('active');
  });
}

// Logout link inside dropdown
const logoutLink = document.getElementById('logoutLink');
if (logoutLink && profileDropdown) {
  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    performLogout();
  });
}

// Close modal on outside click
if (profileModal) {
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeModal();
  });
}

// ==================== IMAGE PREVIEW ====================
// Use the IDs present in `agent_home.html` (productImage/productPreview, workshopImage/workshopPreview)
// The HTML also provides `bindPreview`/`handlePreview` helpers; these listeners are a safe fallback
// in case the inline script didn't run yet.
;(function setupFallbackPreviews() {
  try {
    const pInput = document.getElementById('productImage');
    const pPreview = document.getElementById('productPreview');
    if (pInput && pPreview && !pPreview.src) {
      pInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        pPreview.src = url;
        pPreview.style.display = 'block';
        const box = pPreview.closest('.file-upload'); if (box) box.classList.add('has-image');
        pPreview.onload = () => URL.revokeObjectURL(url);
      });
    }

    const wInput = document.getElementById('workshopImage');
    const wPreview = document.getElementById('workshopPreview');
    if (wInput && wPreview && !wPreview.src) {
      wInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        wPreview.src = url;
        wPreview.style.display = 'block';
        const box = wPreview.closest('.file-upload'); if (box) box.classList.add('has-image');
        wPreview.onload = () => URL.revokeObjectURL(url);
      });
    }
  } catch (err) {
    // noop - non-critical
    console.warn('Preview fallback init error', err);
  }
})();

// ==================== PRODUCT FORM SUBMISSION ====================
const productForm = document.getElementById('product-form');
const productMsg = document.getElementById('product-msg');

if (productForm) {
  productForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productName = formData.get('name');
    
    showMessage(productMsg, `✅ Product "${productName}" added successfully!`, 'success');
    e.target.reset();
    if (productPreview) productPreview.style.display = 'none';
  });
}

function handleProductSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();
    
    // Get form values
    const name = form.querySelector('input[name="name"]').value;
    const description = form.querySelector('textarea[name="description"]').value;
    const price = form.querySelector('input[name="price"]').value;
    const category = form.querySelector('select[name="category"]').value;
    const image = document.getElementById('productImage').files[0];
    const arImage = document.getElementById('arImage').files[0];
    
    // Add to FormData
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("agent_email", getAgentEmail());
    formData.append("category", category);
    
    if (image) {
        formData.append("image", image);
    }
    
    if (arImage) {
        formData.append("ar_image", arImage);
    }

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    fetch('http://127.0.0.1:5000/agent/products', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showMessage('productMsg', 'Product added successfully!', 'success');
            form.reset();
            document.getElementById('productPreview').style.display = 'none';
            document.getElementById('arPreview').style.display = 'none';
            // Refresh product list and analytics
            loadAgentProducts();
            loadDashboardAnalytics();
        } else {
            showMessage('productMsg', data.message || 'Failed to add product', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showMessage('productMsg', 'Server error while adding product', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Post Product';
    });
}

// Add preview for AR/QR image
document.getElementById('arImage')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('arPreview');
            preview.src = ev.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

function loadAgentProducts() {
    const agentEmail = getAgentEmail();
    console.log('Loading products for agent:', agentEmail);
    fetch(`http://127.0.0.1:5000/agent/products?agent_email=${encodeURIComponent(agentEmail)}`)
        .then(res => res.json())
        .then(data => {
            console.log('Products data received:', data);
            if (data.success) {
                const productsList = document.getElementById('productsList');
                if (!productsList) {
                    console.error('productsList element not found!');
                    return;
                }
                if (!data.products || data.products.length === 0) {
                    productsList.innerHTML = '<p>No products yet</p>';
                    return;
                }
                productsList.innerHTML = data.products.map(p => `
          <div class="item-card">
            <img src="${p.image_url || p.image || 'https://via.placeholder.com/200'}" alt="${p.name}">
            <strong>${p.name}</strong>
            <p>${p.description}</p>
            <p class="price">₹${p.price || 0}</p>
            <button class="delete-btn" onclick="deleteProduct(${p.id})">Delete</button>
          </div>
        `).join('');
            } else {
                console.error('Failed to load products:', data.message);
            }
        })
        .catch(err => console.error('Error loading products:', err));
}

// Fix missing showMessage function
function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.className = `message show ${type}`;
    setTimeout(() => {
        element.className = 'message';
    }, 3000);
}

// Add delete product function
function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const agentEmail = getAgentEmail();
    
    fetch(`http://127.0.0.1:5000/agent/products/${productId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_email: agentEmail })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showMessage('productMsg', 'Product deleted successfully', 'success');
            loadAgentProducts(); // Refresh the list
        } else {
            showMessage('productMsg', data.message || 'Failed to delete product', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showMessage('productMsg', 'Server error while deleting product', 'error');
    });
}

// ==================== WORKSHOP FORM SUBMISSION ====================
const workshopForm = document.getElementById('workshop-form');
const workshopMsg = document.getElementById('workshop-msg');

if (workshopForm) {
  workshopForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Add agent email to form data
    formData.append('agent_email', getAgentEmail());
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling...';
    }

    // Submit to backend
    fetch('http://127.0.0.1:5000/agent/workshops', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showMessage(workshopMsg, `✅ Workshop scheduled successfully!`, 'success');
        e.target.reset();
        if (workshopPreview) workshopPreview.style.display = 'none';
        // Refresh workshop list and analytics
        loadAgentWorkshops();
        loadDashboardAnalytics();
      } else {
        showMessage(workshopMsg, data.message || 'Failed to schedule workshop', 'error');
      }
    })
    .catch(err => {
      console.error('Error scheduling workshop:', err);
      showMessage(workshopMsg, 'Server error while scheduling workshop', 'error');
    })
    .finally(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Schedule Workshop';
      }
    });
  });
}

// ==================== PROFILE FORM SUBMISSION ====================
const profileForm = document.getElementById('profile-form');
const profileMsg = document.getElementById('profile-msg');

if (profileForm) {
  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    showMessage(profileMsg, '✅ Profile updated successfully!', 'success');
  });
}

// ==================== SEARCH PRODUCTS ====================
const searchProducts = document.getElementById('search-products');
if (searchProducts) {
  searchProducts.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const products = document.querySelectorAll('#my-products .item-card');
    
    products.forEach(product => {
      const name = product.querySelector('strong')?.textContent.toLowerCase() || '';
      product.style.display = name.includes(searchTerm) ? 'block' : 'none';
    });
  });
}

// ==================== FILTER PRODUCTS BY CATEGORY ====================
const filterCategory = document.getElementById('filter-category');
if (filterCategory) {
  filterCategory.addEventListener('change', (e) => {
    const selectedCategory = e.target.value.toLowerCase();
    const products = document.querySelectorAll('#my-products .item-card');
    
    products.forEach(product => {
      if (selectedCategory === '') {
        product.style.display = 'block';
      } else {
        const category = product.querySelector('.category')?.textContent.toLowerCase() || '';
        product.style.display = category.includes(selectedCategory) ? 'block' : 'none';
      }
    });
  });
}

// ==================== SEARCH WORKSHOPS ====================
const searchWorkshops = document.getElementById('search-workshops');
if (searchWorkshops) {
  searchWorkshops.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const workshops = document.querySelectorAll('#my-workshops .item-card');
    
    workshops.forEach(workshop => {
      const name = workshop.querySelector('strong')?.textContent.toLowerCase() || '';
      workshop.style.display = name.includes(searchTerm) ? 'block' : 'none';
    });
  });
}

// ==================== DELETE ITEM ====================
document.addEventListener('click', (e) => {
  if (e.target.closest('.delete-btn')) {
    const btn = e.target.closest('.delete-btn');
    const itemCard = btn.closest('.item-card');
    if (!itemCard) return;
    
    const itemName = itemCard.querySelector('strong')?.textContent || 'Item';
    
    if (confirm(`Are you sure you want to delete "${itemName}"?`)) {
      itemCard.style.opacity = '0.5';
      itemCard.style.pointerEvents = 'none';
      
      setTimeout(() => {
        itemCard.remove();
      }, 300);
    }
  }
});

// ==================== LOGOUT ====================
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to logout?')) {
      performLogout();
    } else {
      // ensure dropdown closed after cancel
      try { profileDropdown.classList.remove('active'); } catch (err) { }
    }
  });
}

// Centralized logout implementation for agents
function performLogout() {
  try { profileDropdown.classList.remove('active'); } catch (e) { }

  // Clear session storage and any UI state
  try {
    sessionStorage.removeItem('userInfo');
    // clear other possible keys if present
    localStorage.removeItem('rk_registered_workshops');
  } catch (e) { }

  // Inform user briefly then redirect to login
  try {
    alert('Logged out successfully!');
  } catch (e) { }

  try {
    window.location.href = 'login.html';
  } catch (e) {
    window.location.reload();
  }
}

// ==================== WORKSHOP MANAGEMENT ====================
function handleWorkshopSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData();
  
  // Get form values using named inputs
  const title = form.querySelector('input[name="title"]').value;
  const description = form.querySelector('textarea[name="description"]').value;
  const date = form.querySelector('input[name="date"]').value;
  const duration = form.querySelector('input[name="duration"]').value;
  const mode = form.querySelector('select[name="mode"]').value;
  const maxParticipants = form.querySelector('input[name="max_participants"]').value;
  const image = document.getElementById('workshopImage')?.files[0];
  
  // Add to FormData
  formData.append("title", title);
  formData.append("description", description);
  formData.append("date", date);
  formData.append("duration", duration);
  formData.append("mode", mode);
  formData.append("max_participants", maxParticipants);
  formData.append("agent_email", getAgentEmail());
  
  if (image) {
    formData.append("image", image);
  }
  
  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
  
  fetch('http://127.0.0.1:5000/agent/workshops', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showMessage('workshopMsg', 'Workshop scheduled successfully!', 'success');
      form.reset();
      if (document.getElementById('workshopPreview')) {
        document.getElementById('workshopPreview').style.display = 'none';
      }
      loadAgentWorkshops(); // Reload workshops list
      loadDashboardAnalytics(); // Refresh analytics
    } else {
      showMessage('workshopMsg', data.message || 'Failed to schedule workshop', 'error');
    }
  })
  .catch(err => {
    console.error('Error:', err);
    showMessage('workshopMsg', 'Server error while scheduling workshop', 'error');
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Schedule Workshop';
  });
}

function loadAgentWorkshops() {
    const agentEmail = getAgentEmail();
    fetch(`http://127.0.0.1:5000/agent/workshops?agent_email=${encodeURIComponent(agentEmail)}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const workshopsList = document.getElementById('workshopsList');
                if (!workshopsList) return;
                
                workshopsList.innerHTML = data.workshops.map(w => `
                    <div class="item-card">
                        ${w.image ? 
                          `<img src="http://127.0.0.1:5000/uploads/${w.image}" alt="${w.title}">` : 
                          '<div style="width: 100%; height: 150px; background: linear-gradient(135deg, #D2794D, #B55D36); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;"><i class="fas fa-chalkboard-teacher"></i></div>'
                        }
                        <strong>${w.title}</strong>
                        <p>${w.description}</p>
                        <p class="workshop-info">
                            <i class="fas fa-calendar"></i> ${w.date}<br>
                            <i class="fas fa-clock"></i> ${w.duration} hours<br>
                            <i class="fas fa-video"></i> ${w.mode}<br>
                            <i class="fas fa-users"></i> Max ${w.max_participants} participants
                        </p>
                        <button class="delete-btn" onclick="deleteWorkshop(${w.id})">Cancel Workshop</button>
                    </div>
                `).join('') || '<p>No workshops scheduled yet</p>';
            }
        })
        .catch(err => console.error('Error loading workshops:', err));
}

function deleteWorkshop(workshopId) {
    if (!confirm('Are you sure you want to cancel this workshop?')) return;

    const agentEmail = getAgentEmail();
    
    fetch(`http://127.0.0.1:5000/agent/workshops/${workshopId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_email: agentEmail })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showMessage('workshopMsg', 'Workshop cancelled successfully', 'success');
            loadAgentWorkshops();
            loadDashboardAnalytics();
        } else {
            showMessage('workshopMsg', data.message || 'Failed to cancel workshop', 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showMessage('workshopMsg', 'Server error while cancelling workshop', 'error');
    });
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', function() {
    loadDashboardAnalytics();
});

console.log('✅ Dashboard initialized successfully!');

// ==================== ROTATOR DEBUG & LOGGING ====================
// (appends small overlay and logs image discovery/switches)
;(function() {
  const debugCreate = () => {
    const d = document.createElement('div');
    d.id = 'rotator-debug';
    d.style.position = 'fixed';
    d.style.left = '12px';
    d.style.bottom = '12px';
    d.style.padding = '8px 10px';
    d.style.background = 'rgba(0,0,0,0.6)';
    d.style.color = 'white';
    d.style.fontSize = '12px';
    d.style.borderRadius = '6px';
    d.style.zIndex = '2001';
    d.style.maxWidth = '320px';
    d.style.lineHeight = '1.2';
    d.textContent = 'Rotator: waiting...';
    document.body.appendChild(d);
    return d;
  };

  const debugEl = { el: null };
  const debug = (msg) => {
    try {
      console.log('Rotator debug:', msg);
      if (!debugEl.el) debugEl.el = debugCreate();
      debugEl.el.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg);
    } catch (e) { /* ignore */ }
  };

  // wire the global rotator events by polling for the #bg-rotator element
  document.addEventListener('DOMContentLoaded', () => {
    // listen to console logs already emitted by the rotator code
    // (the rotator itself logs on discovery and switches)
    // If rotator images are not visible, this overlay will still show discovery result
    setTimeout(() => {
      const rotator = document.getElementById('bg-rotator');
      if (!rotator) {
        // try to read body's inline background as a fallback
        const bg = getComputedStyle(document.body).backgroundImage || 'none';
        debug('Rotator: no element. body background -> ' + bg);
        return;
      }
      const slides = rotator.querySelectorAll('.slide');
      debug('Rotator: slides found -> ' + slides.length);
      let idx = Array.from(slides).findIndex(s => s.classList.contains('show'));
      if (idx < 0) idx = 0;
      // update overlay when slide switches
      setInterval(() => {
        idx = (idx + 1) % slides.length;
        const url = slides[idx].style.backgroundImage || '';
        debug('Rotator switched -> ' + url);
      }, 20000);
    }, 600);
  });
})();