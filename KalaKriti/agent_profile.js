// agent_profile.js - handles avatar preview and profile save for agent_profile.html
document.addEventListener('DOMContentLoaded', () => {
  const avatarInput = document.getElementById('avatarInput');
  const avatarPreview = document.getElementById('avatarPreview');
  const avatarRemove = document.getElementById('avatarRemove');
  const avatarLabel = document.getElementById('avatarLabel');

  function applyAvatarURL(url) {
    if (!url) return;
    avatarPreview.src = url;
    avatarPreview.style.display = 'block';
    avatarRemove.style.display = 'flex';
    const box = avatarPreview.closest('.file-upload');
    if (box) box.classList.add('has-image');
    avatarLabel.style.display = 'none';
  }

  function applyAvatarFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    avatarPreview.src = url;
    avatarPreview.style.display = 'block';
    avatarRemove.style.display = 'flex';
    const box = avatarPreview.closest('.file-upload');
    if (box) box.classList.add('has-image');
    avatarLabel.style.display = 'none';
    avatarPreview.onload = () => URL.revokeObjectURL(url);
  }

  avatarInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) applyAvatarFile(f);
  });

  avatarRemove.addEventListener('click', () => {
    avatarInput.value = '';
    avatarPreview.src = '';
    avatarPreview.style.display = 'none';
    avatarRemove.style.display = 'none';
    avatarLabel.style.display = 'flex';
    const box = avatarPreview.closest('.file-upload');
    if (box) box.classList.remove('has-image');
  });

  // helper to get agent email from session storage or input
  function getAgentEmail() {
    const userInfo = sessionStorage.getItem('userInfo');
    if (userInfo) {
      try { const user = JSON.parse(userInfo); return user.email || user.username; } catch (e) {}
    }
    const emailInput = document.getElementById('email');
    if (emailInput && emailInput.value) return emailInput.value;
    return null;
  }

  // load profile from backend if available
  (function loadProfile() {
    const email = getAgentEmail();
    if (!email) return;
    fetch(`http://127.0.0.1:5000/agent/profile?agent_email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.profile) {
          const p = data.profile;
          if (p.full_name) document.getElementById('full_name').value = p.full_name;
          if (p.email) document.getElementById('email').value = p.email;
          if (p.phone) document.getElementById('phone').value = p.phone;
          if (p.shop_name) document.getElementById('shop_name').value = p.shop_name;
          if (p.address) document.getElementById('address').value = p.address;
          if (p.bio) document.getElementById('bio').value = p.bio;
          if (p.payout_info) document.getElementById('payout_info').value = p.payout_info;
          if (p.social) document.getElementById('social').value = p.social;
          if (p.avatar_url) applyAvatarURL(p.avatar_url);
        }
      })
      .catch(err => {
        // ignore - offline/endpoint not available
        console.warn('Could not load profile from server', err);
      });
  })();

});

function handleAgentProfileSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById('profilePageMsg');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const fd = new FormData();
  fd.append('full_name', document.getElementById('full_name').value || '');
  fd.append('email', document.getElementById('email').value || '');
  fd.append('phone', document.getElementById('phone').value || '');
  fd.append('shop_name', document.getElementById('shop_name').value || '');
  fd.append('address', document.getElementById('address').value || '');
  fd.append('bio', document.getElementById('bio').value || '');
  fd.append('payout_info', document.getElementById('payout_info').value || '');
  fd.append('social', document.getElementById('social').value || '');

  const avatarInput = document.getElementById('avatarInput');
  if (avatarInput && avatarInput.files && avatarInput.files[0]) {
    fd.append('avatar', avatarInput.files[0]);
  }

  // If you have a backend endpoint, replace URL below. For now attempt a POST; if it fails, we store locally.
  fetch('http://127.0.0.1:5000/agent/profile', {
    method: 'POST',
    body: fd
  })
  .then(res => res.json())
  .then(data => {
    if (data && data.success) {
      msgEl.textContent = 'Profile saved successfully.';
      msgEl.className = 'message show success';
      try {
        // if server returned profile, use it to update UI/storage
        if (data.profile) {
          const p = data.profile;
          const user = { username: p.full_name || p.email, email: p.email };
          sessionStorage.setItem('userInfo', JSON.stringify(user));
          // update avatar preview if available
          if (p.avatar_url) {
            const avatarPreview = document.getElementById('avatarPreview');
            const avatarRemove = document.getElementById('avatarRemove');
            const avatarLabel = document.getElementById('avatarLabel');
            avatarPreview.src = p.avatar_url;
            avatarPreview.style.display = 'block';
            avatarRemove.style.display = 'flex';
            avatarLabel.style.display = 'none';
            const box = avatarPreview.closest('.file-upload'); if (box) box.classList.add('has-image');
          }
        } else {
          const current = sessionStorage.getItem('userInfo');
          const user = current ? JSON.parse(current) : {};
          user.username = document.getElementById('full_name').value || user.username;
          user.email = document.getElementById('email').value || user.email;
          sessionStorage.setItem('userInfo', JSON.stringify(user));
        }
      } catch (e) { console.warn('Error updating local profile after save', e); }
    } else {
      throw new Error((data && data.message) ? data.message : 'Failed to save');
    }
  })
  .catch(err => {
    console.warn('Profile save failed (fallback to local):', err);
    msgEl.textContent = 'Could not save to server — changes saved locally.';
    msgEl.className = 'message show info';
    try {
      const user = { username: document.getElementById('full_name').value, email: document.getElementById('email').value };
      sessionStorage.setItem('userInfo', JSON.stringify(user));
    } catch (e) {}
  })
  .finally(() => {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Profile';
    setTimeout(() => { msgEl.className = 'message'; }, 3500);
  });
}
