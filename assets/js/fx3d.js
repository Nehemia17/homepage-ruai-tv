// ============================================================
// RUAI TV — fx3d.js
// Efek 3D ringan tanpa library: kartu miring mengikuti kursor,
// parallax orbit hero, dan "reveal" 3D saat di-scroll.
//
// Aman by default:
//  - hanya aktif di perangkat dengan kursor (bukan layar sentuh)
//  - mati total bila pengguna memilih "kurangi gerakan"
//  - tidak mengubah markup/data: elemen dipilih lewat daftar di bawah
// ============================================================

(() => {
  // ─── Konfigurasi (satu tempat) ─────────────────────────────
  // Sudut miring maksimum (derajat) per jenis elemen
  const TILT = [
    { selector: '.hero-primetime-card', max: 9 },
    { selector: '.program-card',        max: 7 },
    { selector: '.vmp-card',            max: 6 },
    { selector: '.siaran-card',         max: 6 },
    { selector: '.motto-banner',        max: 2.5 },
  ];

  // Elemen yang muncul dengan efek 3D saat pertama kali terlihat
  const REVEAL = [
    '#program .section-header-row',
    '#jadwal .jadwal-header-row',
    '.schedule-wrap',
    '.motto-banner',
    '.vmp-card',
    '.tentang-detail-grid > *',
  ];

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;

  // ─── 1. Tilt kartu (delegasi event: kartu dibuat dinamis oleh catalog.js) ───
  const tiltSelector = TILT.map(t => t.selector).join(',');
  const maxFor = (el) => (TILT.find(t => el.matches(t.selector)) || { max: 6 }).max;

  let active = null;      // elemen yang sedang miring
  let frame = 0;
  let last = null;        // event pointer terakhir (dibatasi per frame)

  const ensureGlare = (el) => {
    if (el.querySelector(':scope > .tilt-glare')) return;
    const glare = document.createElement('span');
    glare.className = 'tilt-glare';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
  };

  const resetTilt = (el) => {
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
  };

  const applyTilt = () => {
    frame = 0;
    if (!last) return;
    const el = last.target.closest?.(tiltSelector);

    if (active && active !== el) { resetTilt(active); active = null; }
    if (!el || el.classList.contains('hidden')) return;

    const rect = el.getBoundingClientRect();
    const px = (last.clientX - rect.left) / rect.width - 0.5;   // -0.5 .. 0.5
    const py = (last.clientY - rect.top) / rect.height - 0.5;
    const max = maxFor(el);

    ensureGlare(el);
    el.style.setProperty('--rx', `${(-py * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    el.classList.add('is-tilting');
    active = el;
  };

  // ─── 2. Parallax orbit hero ───
  const hero = document.getElementById('beranda');
  const stage = hero?.querySelector('.hero-3d');

  const applyParallax = (e) => {
    if (!stage) return;
    const rect = hero.getBoundingClientRect();
    const hx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // -1 .. 1
    const hy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    stage.style.setProperty('--hx', hx.toFixed(3));
    stage.style.setProperty('--hy', hy.toFixed(3));
  };

  const enablePointerFx = () => {
    if (!finePointer.matches) return;

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      last = e;
      if (!frame) frame = requestAnimationFrame(applyTilt);
      if (hero && hero.contains(e.target)) applyParallax(e);
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
      resetTilt(active); active = null;
      stage?.style.removeProperty('--hx'); stage?.style.removeProperty('--hy');
    });
  };

  // ─── 3. Reveal 3D saat scroll ───
  const enableReveal = () => {
    if (!('IntersectionObserver' in window)) return;

    const targets = [...new Set(REVEAL.flatMap(sel => [...document.querySelectorAll(sel)]))];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('in-view');
        observer.unobserve(el);
        // Setelah selesai, kembalikan ke keadaan semula agar hover/tilt normal
        const cleanup = (ev) => {
          if (ev.target !== el || ev.propertyName !== 'transform') return;
          el.classList.remove('reveal', 'in-view');
          el.style.removeProperty('--reveal-delay');
          el.removeEventListener('transitionend', cleanup);
        };
        el.addEventListener('transitionend', cleanup);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight) return;           // sudah terlihat: jangan disembunyikan
      const index = [...el.parentElement.children].filter(c => c.className === el.className).indexOf(el);
      el.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 4) * 90}ms`);
      el.classList.add('reveal');
      observer.observe(el);
    });
  };

  const init = () => {
    enablePointerFx();
    enableReveal();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
