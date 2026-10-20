/* ============================================================
   RUAI TV — Admin UI helpers (admin-ui.js)
   Perilaku tampilan bersama: ikon & sidebar mobile.
   Tidak berisi logika data/auth — itu tetap di admin.js.
   ============================================================ */

(() => {
  const ICON_SPRITE = '/admin/assets/icons.svg';

  // Markup ikon dari sprite; dipakai juga oleh admin.js untuk HTML dinamis
  window.AdminUI = {
    icon(name, extraClass = '') {
      return `<svg class="icon ${extraClass}" aria-hidden="true" focusable="false"><use href="${ICON_SPRITE}#${name}"></use></svg>`;
    }
  };

  // ─── Sidebar mobile (hamburger) ───
  const MOBILE_QUERY = window.matchMedia('(max-width: 900px)');

  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.admin-sidebar');
    const toggle  = document.getElementById('admin-menu-toggle');
    if (!sidebar || !toggle) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const setOpen = (open, { restoreFocus = true } = {}) => {
      sidebar.classList.toggle('open', open);
      backdrop.classList.toggle('show', open);
      document.body.classList.toggle('sidebar-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        sidebar.querySelector('.nav-item')?.focus();
      } else if (restoreFocus && MOBILE_QUERY.matches) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
    backdrop.addEventListener('click', () => setOpen(false));
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a.nav-item') && MOBILE_QUERY.matches) setOpen(false, { restoreFocus: false });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) setOpen(false);
    });
    // Kembali ke layar lebar: pastikan state overlay bersih
    MOBILE_QUERY.addEventListener('change', (e) => {
      if (!e.matches) setOpen(false, { restoreFocus: false });
    });
  });
})();
