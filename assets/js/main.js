// ============================================================
// RUAI TV — main.js
// Handles: Dynamic component loading (Navbar & Footer),
//          Navbar scroll, mobile menu, scroll-to-top, smooth scroll
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const LIVE_URL = 'https://www.youtube.com/@ruaitv/live';

  // ─── 1. Dynamic Component Loader ─────────────────────────
  const loadComponent = async (containerId, filePath) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      container.innerHTML = await res.text();
    } catch (err) {
      console.error(`Gagal memuat komponen ${filePath}:`, err);
    }
  };

  // Load Navbar & Footer simultaneously
  await Promise.all([
    loadComponent('navbar-container', 'includes/navbar.html'),
    loadComponent('footer-container', 'includes/footer.html')
  ]);

  // ─── 2. Navbar Scroll Effect ─────────────────────────────
  const navbar = document.getElementById('navbar');

  const handleScroll = () => {
    if (window.scrollY > 40) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }

    // Scroll-to-top button
    const scrollBtn = document.getElementById('scroll-top');
    if (scrollBtn) {
      if (window.scrollY > 500) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // initial check

  // ─── 3. Scroll to top ────────────────────────────────────
  document.getElementById('scroll-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── 4. Mobile Menu Toggle ───────────────────────────────
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');

  menuToggle?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.contains('open');
    mobileMenu?.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', !isOpen);
  });

  // Close mobile menu on nav link click
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu?.classList.remove('open');
      menuToggle?.setAttribute('aria-expanded', 'false');
    });
  });

  // ─── 5. Hero detail button → buka modal Warta Ruai ───────
  document.getElementById('hero-detail-btn')?.addEventListener('click', () => {
    if (typeof window.openProgramModal === 'function') {
      window.openProgramModal('warta-ruai');
    }
  });

  // ─── 6. Smooth scroll for anchor links ───────────────────
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    const targetId = anchor.getAttribute('href').slice(1);
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      e.preventDefault();
      const navEl = document.getElementById('navbar');
      const navHeight = navEl ? navEl.offsetHeight : 0;
      const top = targetEl.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });

  // ─── 7. Positioning tabs (Tentang section) ───────────────
  document.querySelectorAll('.pos-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.pos-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
    });
  });

  // ─── 9. Warta Ruai Live Schedule Status Checker ─────────
  const updateLiveIndicatorStatus = () => {
    const liveBtn = document.getElementById('nav-live-btn');
    if (!liveBtn) return;

    // Check URL override for testing (?live=true or ?live=false)
    const urlParams = new URLSearchParams(window.location.search);
    let isLive = false;

    if (urlParams.has('live')) {
      isLive = urlParams.get('live') === 'true';
    } else {
      // Calculate current time in WIB (GMT+7)
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
      const wib = new Date(utcMs + (7 * 3600000));

      const day = wib.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
      const hours = wib.getHours();
      const minutes = wib.getMinutes();
      const currentMin = hours * 60 + minutes;

      // Warta Ruai tayang Senin – Sabtu (Day 1 to 6)
      const isWartaRuaiDay = (day >= 1 && day <= 6);

      if (isWartaRuaiDay) {
        // Sesi Pagi: 07.00 – 08.00 WIB (420 - 480 min)
        // Sesi Siang: 13.00 – 14.00 WIB (780 - 840 min)
        // Sesi Malam: 19.00 – 20.00 WIB (1140 - 1200 min)
        const isPagi  = (currentMin >= 420 && currentMin < 480);
        const isSiang = (currentMin >= 780 && currentMin < 840);
        const isMalam = (currentMin >= 1140 && currentMin < 1200);

        isLive = isPagi || isSiang || isMalam;
      }
    }

    if (isLive) {
      liveBtn.classList.add('is-live');
      liveBtn.classList.remove('is-offline');
      liveBtn.setAttribute('title', '🔴 Warta Ruai sedang tayang LIVE sekarang!');
    } else {
      liveBtn.classList.add('is-offline');
      liveBtn.classList.remove('is-live');
      liveBtn.setAttribute('title', 'Siaran live Warta Ruai: 07.00, 13.00, dan 19.00 WIB (Senin – Sabtu)');
    }
  };

  // Initial check & setup interval (updates every 30s)
  updateLiveIndicatorStatus();
  setInterval(updateLiveIndicatorStatus, 30000);

});


