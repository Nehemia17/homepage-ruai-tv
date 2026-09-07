/* ============================================================
   RUAI TV — Admin Login Logic (login.js)
   Handles auth requests with PHP API & Static Fallback
   ============================================================ */

(() => {
  const SESSION_KEY = 'ruai_admin_session';

  // 1. Redirect if already authenticated
  const existingSession = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (existingSession) {
    try {
      const parsed = JSON.parse(existingSession);
      if (parsed && parsed.authenticated) {
        window.location.href = 'index.html';
        return;
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggle();
    initLoginForm();
    initForgotPassword();
  });

  // ─── Forgot Password Handler ───
  function initForgotPassword() {
    const forgotBtn = document.getElementById('link-forgot-pass');
    forgotBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Bantuan Lupa Password',
          html: 'Silakan hubungi <strong>Administrator IT Redaksi Ruai TV</strong> atau periksa konfigurasi akun pada database MySQL `users`.',
          icon: 'info',
          confirmButtonColor: '#DC2626',
          confirmButtonText: 'Saya Mengerti'
        });
      } else {
        alert('Silakan hubungi administrator IT Redaksi Ruai TV jika Anda lupa password.');
      }
    });
  }

  // ─── Password Toggle ───
  function initPasswordToggle() {
    const passwordInput = document.getElementById('login-password');
    const toggleBtn     = document.getElementById('btn-toggle-password');

    toggleBtn?.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    });
  }

  // ─── Login Form Submit ───
  function initLoginForm() {
    const form      = document.getElementById('login-form');
    const btnSubmit = document.getElementById('btn-login');
    const alertBox  = document.getElementById('login-alert-box');
    const alertText = document.getElementById('login-alert-text');

    const showAlert = (msg) => {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Masuk',
          text: msg,
          confirmButtonColor: '#DC2626',
          confirmButtonText: 'Coba Lagi'
        });
      } else if (alertBox && alertText) {
        alertText.textContent = msg;
        alertBox.style.display = 'block';
      }
    };

    const hideAlert = () => {
      if (alertBox) alertBox.style.display = 'none';
    };

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const remember = document.getElementById('login-remember').checked;

      if (!username || !password) {
        showAlert('Username dan password wajib diisi.');
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Memverifikasi...</span>';

      const loginEndpoints = [
        '../api/login.php',
        'http://localhost/Homepage%20Statis%20Ruai-TV/api/login.php',
        'http://localhost/api/login.php'
      ];

      let authSuccess = false;
      let userData = null;

      for (const endpoint of loginEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });

          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const result = await res.json();
            if (result.status === 'success') {
              authSuccess = true;
              userData = result.user || { username, fullname: 'Admin Redaksi Ruai TV', role: 'superadmin' };
              break;
            } else if (result.status === 'error') {
              showAlert(result.message || 'Username atau password salah.');
              btnSubmit.disabled = false;
              btnSubmit.innerHTML = '<span>Masuk ke Admin Panel</span><span>➔</span>';
              return;
            }
          }
        } catch (err) {
          // Continue to next endpoint or fallback
        }
      }

      // Static fallback if API is unreachable
      if (!authSuccess) {
        if (username === 'admin' && (password === 'admin123' || password === 'ruaitv2026')) {
          authSuccess = true;
          userData = {
            username: 'admin',
            fullname: 'Admin Redaksi Ruai TV',
            role: 'superadmin'
          };
        }
      }

      if (authSuccess) {
        const sessionPayload = JSON.stringify({
          authenticated: true,
          user: userData,
          loginTime: new Date().toISOString()
        });

        if (remember) {
          localStorage.setItem(SESSION_KEY, sessionPayload);
        } else {
          sessionStorage.setItem(SESSION_KEY, sessionPayload);
        }

        btnSubmit.innerHTML = '<span>Login Berhasil! ➔</span>';
        
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'success',
            title: 'Login Berhasil!',
            text: `Selamat datang kembali, ${userData.fullname || username}!`,
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.href = 'index.html';
          });
        } else {
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 500);
        }
      } else {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Masuk ke Admin Panel</span><span>➔</span>';
        showAlert('Username atau password yang Anda masukkan salah.');
      }
    });
  }
})();
