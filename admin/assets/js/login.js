/* ============================================================
   RUAI TV — Admin Login Logic (login.js)
   Autentikasi via Supabase Auth (email + password)
   ============================================================ */

(() => {
  // 1. Redirect jika sudah punya sesi yang valid di server
  (async () => {
    if (!window.RuaiSupabase?.getSession()) return;
    const user = await window.RuaiSupabase.verifySession();
    if (user) window.location.href = '/admin/index.html';
  })();

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
      const msg = 'Reset password dilakukan oleh pemilik project Supabase: Dashboard → Authentication → Users → pilih akun → Send password recovery / Reset password.';
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Bantuan Lupa Password',
          html: 'Hubungi <strong>Administrator IT Redaksi Ruai TV</strong>. Reset password dilakukan dari dashboard Supabase (Authentication → Users).',
          icon: 'info',
          confirmButtonColor: '#DC2626',
          confirmButtonText: 'Saya Mengerti'
        });
      } else {
        alert(msg);
      }
    });
  }

  // ─── Password Toggle ───
  function initPasswordToggle() {
    const passwordInput = document.getElementById('login-password');
    const toggleBtn     = document.getElementById('btn-toggle-password');

    toggleBtn?.addEventListener('click', () => {
      const reveal = passwordInput.type === 'password';
      passwordInput.type = reveal ? 'text' : 'password';
      toggleBtn.classList.toggle('is-visible', reveal);
      toggleBtn.setAttribute('aria-label', reveal ? 'Sembunyikan password' : 'Tampilkan password');
    });
  }

  // ─── Login Form Submit ───
  function initLoginForm() {
    const form      = document.getElementById('login-form');
    const btnSubmit = document.getElementById('btn-login');
    const alertBox  = document.getElementById('login-alert-box');
    const alertText = document.getElementById('login-alert-text');

    const arrowIcon = '<svg class="icon" aria-hidden="true" focusable="false"><use href="/admin/assets/icons.svg#arrow-right"></use></svg>';
    const idleLabel = `<span>Masuk ke Admin Panel</span>${arrowIcon}`;

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

      const email    = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const remember = document.getElementById('login-remember').checked;

      if (!email || !password) {
        showAlert('Email dan password wajib diisi.');
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Memverifikasi...</span>';

      try {
        const session = await window.RuaiSupabase.signIn(email, password, remember);
        const name = session.user.fullname || email;

        btnSubmit.innerHTML = `<span>Login Berhasil!</span>${arrowIcon}`;

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'success',
            title: 'Login Berhasil!',
            text: `Selamat datang kembali, ${name}!`,
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.href = '/admin/index.html';
          });
        } else {
          setTimeout(() => {
            window.location.href = '/admin/index.html';
          }, 500);
        }
      } catch (err) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = idleLabel;
        showAlert(err.message || 'Login gagal. Coba lagi.');
      }
    });
  }
})();
