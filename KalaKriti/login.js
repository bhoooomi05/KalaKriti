// ================= AUTO POPUP FUNCTIONALITY =================
// Show login modal automatically when page loads
window.addEventListener('load', function() {
  setTimeout(() => {
    showLoginModal();
  }, 800); // Show after 800ms for dramatic effect
});

// Modal control functions
function showLoginModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  modalOverlay.classList.add('show', 'auto-show');
}

function closeModal() {
  const modalOverlay = document.getElementById('modalOverlay');
  modalOverlay.classList.remove('show', 'auto-show');
}

// Close modal when clicking outside the container
document.addEventListener('DOMContentLoaded', function() {
  const modalOverlay = document.getElementById('modalOverlay');
  const container = document.getElementById('container');
  const bgVideo = document.getElementById('bgVideo');
  const soundBtn = document.getElementById('videoSoundToggle');
  
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Prevent modal from closing when clicking inside container
  container.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Close with ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Sound toggle for the background video (user gesture required for audio)
  if (bgVideo && soundBtn) {
    function updateSoundLabel() {
      soundBtn.textContent = bgVideo.muted ? '🔊 Enable Sound' : '🔇 Mute Sound';
      soundBtn.title = bgVideo.muted ? 'Enable sound' : 'Mute sound';
      soundBtn.setAttribute('aria-label', soundBtn.title);
    }
    updateSoundLabel();

    soundBtn.addEventListener('click', async function() {
      try {
        bgVideo.muted = !bgVideo.muted;
        bgVideo.volume = bgVideo.muted ? 0 : 0.6;
        // Ensure playback continues when unmuted
        await bgVideo.play().catch(() => {});
        updateSoundLabel();
      } catch (_) {}
    });
  }
});

// ================= FORM ANIMATIONS =================
const registerButton = document.getElementById("register");
const loginButton = document.getElementById("login");
const container = document.getElementById("container");

registerButton.addEventListener("click", () => {
  container.classList.add("right-panel-active");
});

loginButton.addEventListener("click", () => {
  container.classList.remove("right-panel-active");
});

// ================= REGISTER VALIDATION =================
const form = document.querySelector(".register-container form");
const username = document.getElementById("username");
const usernameError = document.querySelector("#username-error");
const email = document.getElementById("email");
const emailError = document.querySelector("#email-error");
const password = document.getElementById("password");
const passwordError = document.querySelector("#password-error");
const confirmPassword = document.getElementById("confirm-password");
const confirmPasswordError = document.querySelector("#confirm-password-error");
const role = document.getElementById("role");

// Email validation function
function checkEmail(email) {
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
}

// Real-time email validation
email.addEventListener("input", function () {
  if (email.value === "") {
    emailError.textContent = "";
  } else {
    emailError.textContent = !checkEmail(email.value) ? "Email is not valid" : "";
  }
  reflectInvalid(email.parentElement, emailError);
});

// Real-time username validation
username.addEventListener("input", function () {
  if (username.value === "") {
    usernameError.textContent = "";
  } else if (username.value.length < 4) {
    usernameError.textContent = "Username must be at least 4 characters.";
  } else if (username.value.length > 20) {
    usernameError.textContent = "Username must be less than 20 characters.";
  } else {
    usernameError.textContent = "";
  }
  reflectInvalid(username.parentElement, usernameError);
});

// Real-time password validation
password.addEventListener("input", function () {
  if (password.value === "") {
    passwordError.textContent = "";
  } else if (password.value.length < 8) {
    passwordError.textContent = "Password must be at least 8 characters.";
  } else if (password.value.length > 20) {
    passwordError.textContent = "Password must be less than 20 characters.";
  } else {
    passwordError.textContent = "";
  }
  reflectInvalid(password.parentElement, passwordError);
  
  // Also check confirm password if it has value
  if (confirmPassword.value !== "") {
    if (confirmPassword.value !== password.value) {
      confirmPasswordError.textContent = "Passwords do not match.";
    } else {
      confirmPasswordError.textContent = "";
    }
    reflectInvalid(confirmPassword.parentElement, confirmPasswordError);
  }
});

// Real-time confirm password validation
confirmPassword.addEventListener("input", function () {
  if (confirmPassword.value === "") {
    confirmPasswordError.textContent = "";
  } else if (confirmPassword.value !== password.value) {
    confirmPasswordError.textContent = "Passwords do not match.";
  } else {
    confirmPasswordError.textContent = "";
  }
  reflectInvalid(confirmPassword.parentElement, confirmPasswordError);
});

// Inline status helpers (no popups)
function setStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.remove('success', 'error');
  if (type) el.classList.add(type);
}

// Toggle red highlight visibility based on small error text
function reflectInvalid(container, smallEl) {
  if (!container || !smallEl) return;
  container.classList.toggle('invalid', !!(smallEl.textContent && smallEl.textContent.trim().length));
}

// Register form submission
form.addEventListener("submit", function (e) {
  e.preventDefault();
  
  // Check if all validations pass
  const isValid = 
    username.value.length >= 4 && username.value.length <= 20 &&
    checkEmail(email.value) &&
    password.value.length >= 8 && password.value.length <= 20 &&
    confirmPassword.value === password.value &&
    role.value !== "";

  if (isValid &&
      usernameError.textContent === "" &&
      emailError.textContent === "" &&
      passwordError.textContent === "" &&
      confirmPasswordError.textContent === "") {
    const regStatus = document.getElementById('register-status');
    setStatus(regStatus, '⏳ Registering...', '');
    // Send registration data to backend
    fetch("http://127.0.0.1:5000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value,
        email: email.value,
        password: password.value,
        role: role.value
      })
    })
    .then(res => res.json())
    .then(data => {
      setStatus(regStatus, data.message || 'Registered successfully', data.success ? 'success' : 'error');
      if (data.success) {
        // Automatically switch to login form
        container.classList.remove("right-panel-active");
      }
    })
    .catch(() => setStatus(regStatus, "Registration failed. Server error.", 'error'));
  } else {
    const regStatus = document.getElementById('register-status');
    setStatus(regStatus, "Please fill all fields correctly.", 'error');
    // highlight all invalid ones
    reflectInvalid(username.parentElement, usernameError);
    reflectInvalid(email.parentElement, emailError);
    reflectInvalid(password.parentElement, passwordError);
    reflectInvalid(confirmPassword.parentElement, confirmPasswordError);
  }
});

// ================= LOGIN VALIDATION =================
const lgForm = document.querySelector(".form-lg");
const lgUsername = document.querySelector(".username-2");
const lgUsernameError = document.querySelector(".username-error-2");
const lgPassword = document.querySelector(".password-2");
const lgPasswordError = document.querySelector(".password-error-2");
const lgRole = document.querySelector(".role-2");

// Login username validation function
function checkUsername2(lgUsername) {
  return lgUsername && lgUsername.length >= 2; // At least 2 characters
}

// Real-time login username validation
lgUsername.addEventListener("input", function () {
  if (lgUsername.value === "") {
    lgUsernameError.textContent = "";
  } else if (lgUsername.value.length < 2) {
    lgUsernameError.textContent = "Username must be at least 2 characters.";
  } else {
    lgUsernameError.textContent = "";
  }
  reflectInvalid(lgUsername.parentElement, lgUsernameError);
});

// Real-time login password validation
lgPassword.addEventListener("input", function () {
  if (lgPassword.value === "") {
    lgPasswordError.textContent = "";
  } else if (lgPassword.value.length < 8) {
    lgPasswordError.textContent = "Password must be at least 8 characters.";
  } else if (lgPassword.value.length > 20) {
    lgPasswordError.textContent = "Password must be less than 20 characters.";
  } else {
    lgPasswordError.textContent = "";
  }
  reflectInvalid(lgPassword.parentElement, lgPasswordError);
});

// Login form submission
lgForm.addEventListener("submit", function (e) {
  e.preventDefault();

  // Simple validation - just check if fields are filled
  const isValidLogin = lgUsername.value.length >= 2 && 
                       lgPassword.value.length >= 8 && 
                       lgPassword.value.length <= 20;

  if (isValidLogin) {
    const lgStatus = document.getElementById('login-status');
    setStatus(lgStatus, 'Logging in...', '');
    // Send login data to backend
    fetch("http://127.0.0.1:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: lgUsername.value,
        password: lgPassword.value
      })
    })
    .then(res => res.json())
    .then(data => {
      setStatus(lgStatus, data.message || 'Login successful', data.success ? 'success' : 'error');
      if (data.success) {
        // Optionally keep modal open to show success message clearly
        
        // Get the role from backend response or use the selected role
        const role = data.role || lgRole.value;
        
        // Store user information in sessionStorage
        const userInfo = {
          username: lgUsername.value,
          role: role,
          email: lgUsername.value // Using username as email for now
        };
        sessionStorage.setItem('userInfo', JSON.stringify(userInfo));
        
        // Redirect based on role
        setTimeout(() => {
          if (role === "user") {
            window.location.href = "customer_home.html";
          } else if (role === "KalaKar") {
            window.location.href = "agent_home.html";
          } else {
            // Default redirect to customer if role not recognized
            window.location.href = "customer_home.html";
          }
        }, 900);
      }
    })
    .catch(() => setStatus(lgStatus, "Login failed. Server error.", 'error'));
  } else {
    const lgStatus = document.getElementById('login-status');
    setStatus(lgStatus, "Please enter username and password correctly.", 'error');
    reflectInvalid(lgUsername.parentElement, lgUsernameError);
    reflectInvalid(lgPassword.parentElement, lgPasswordError);
  }
});
