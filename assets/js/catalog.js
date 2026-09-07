// ============================================================
// RUAI TV — catalog.js  v3 (Pixel-perfect Figma)
// ============================================================

(async () => {

  const LIVE_URL = 'https://www.youtube.com/@ruaitv/live';
  let   programs = [];

  // ─── Load data ────────────────────────────────────────────
  const STORAGE_KEY = 'ruai_tv_programs_data';
  const API_URL = 'api/programs.php';

  // 1. Try MySQL REST API
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const apiData = await res.json();
      if (Array.isArray(apiData) && apiData.length > 0) {
        programs = apiData;
      }
    }
  } catch (e) {}

  // 2. Fallback to localStorage
  if (!programs || programs.length === 0) {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        programs = JSON.parse(localData);
      } catch (e) {
        console.warn('Failed to parse localStorage in catalog.js:', e);
      }
    }
  }

  // 3. Fallback to programs.json
  if (!programs || programs.length === 0) {
    try {
      const res = await fetch('assets/data/programs.json');
      if (!res.ok) throw new Error(res.status);
      programs = await res.json();
    } catch (e) {
      console.error('Gagal load programs.json:', e);
      const grid = document.getElementById('programs-grid');
      if (grid) grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:#9CA3AF;">
          <p style="font-size:14px;font-weight:600;margin-bottom:6px;">⚠️ Data gagal dimuat</p>
          <p style="font-size:12px;">Pastikan akses via <code>http://localhost:3000</code></p>
        </div>`;
      return;
    }
  }

  // ─── Category config ─────────────────────────────────────
  const catMap = {
    'berita':     'PROGRAM BERITA',
    'non-news':   'NON-NEWS',
    'kerja-sama': 'KERJA SAMA',
  };

  // ─── Format helpers ───────────────────────────────────────
  const getScheduleText = (schedule) => {
    if (!schedule) return '—';
    const { pagi, siang, malam } = schedule;
    if (pagi?.active && pagi.time && pagi.days) {
      return `${pagi.days}, ${pagi.time}`;
    }
    if (siang?.active && siang.time && siang.days) {
      return `${siang.days}, ${siang.time}`;
    }
    if (malam?.active && malam.time && malam.days) {
      return `${malam.days}, ${malam.time}`;
    }
    // Menyesuaikan / Cek jadwal
    const any = [pagi,siang,malam].find(s => s?.active);
    if (any?.time) return any.time;
    return '—';
  };

  // ─── Update counters ──────────────────────────────────────
  const counts = {
    semua:        programs.length,
    aktif:        programs.filter(p => p && p.status === 'aktif').length,
    arsip:        programs.filter(p => p && p.status === 'arsip').length,
    berita:       programs.filter(p => p && p.category === 'berita').length,
    'non-news':   programs.filter(p => p && p.category === 'non-news').length,
    'kerja-sama': programs.filter(p => p && p.category === 'kerja-sama').length,
  };

  document.querySelectorAll('[data-count]').forEach(el => {
    const key = el.dataset.count;
    if (counts[key] !== undefined) el.textContent = counts[key];
  });

  const totalAktif = document.getElementById('total-aktif');
  const totalArsip = document.getElementById('total-arsip');
  if (totalAktif) totalAktif.textContent = counts.aktif;
  if (totalArsip) totalArsip.textContent = counts.arsip;

  // ─── Sort programs ────────────────────────────────────────
  // Priority: aktif+bergambar(0) > aktif+tanpa gambar(1) > arsip+bergambar(2) > arsip+tanpa gambar(3)
  const sortScore = (p) => {
    if (!p) return 99;
    const isAktif = p.status === 'aktif';
    const hasImg  = !!(p.thumbnail_url);
    if  (isAktif &&  hasImg) return 0;
    if  (isAktif && !hasImg) return 1;
    if (!isAktif &&  hasImg) return 2;
    return 3;
  };
  programs.sort((a, b) => sortScore(a) - sortScore(b));

  // ─── Render cards ─────────────────────────────────────────
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  programs.forEach((p, idx) => {
    if (!p) return;
    const catLabel  = catMap[p.category] || (p.category ? p.category.toUpperCase() : 'PROGRAM');
    const isAktif   = p.status === 'aktif';
    const schedText = getScheduleText(p.schedule);

    // Card
    const card = document.createElement('article');
    card.className = `program-card${!isAktif ? ' arsip-card' : ''}`;
    card.dataset.status   = p.status;
    card.dataset.category = p.category;
    card.dataset.id       = p.id;
    card.dataset.hasImg   = p.thumbnail_url ? 'true' : 'false';
    card.style.animationDelay = `${idx * 28}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Lihat detail: ${p.title}`);

    // Duration pill — show if not "—"
    const durationHtml = p.duration && p.duration !== '—'
      ? `<div class="card-duration-pill">${p.duration}</div>`
      : '';

    // Image area — tampilkan gambar jika ada thumbnail, jika tidak tampilkan placeholder abu-abu
    const imgArea = p.thumbnail_url ? `
      <div class="card-img-area">
        <img
          class="card-thumb"
          src="${p.thumbnail_url}"
          alt="${p.title}"
          loading="lazy"
          onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'card-no-thumb\\'><div class=\\'card-circle-deco\\'></div></div>${durationHtml.replace(/"/g,"'")}<div class=\\'card-cat-badge\\'>${catLabel}</div><div class=\\'card-status-badge ${isAktif ? 'aktif' : 'arsip'}\\'>${isAktif ? 'Aktif' : 'ARSIP'}</div>'"
        />
        ${durationHtml}
        <div class="card-cat-badge">${catLabel}</div>
        <div class="card-status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'ARSIP'}</div>
      </div>
    ` : `
      <div class="card-img-area">
        <div class="card-no-thumb"><div class="card-circle-deco"></div></div>
        ${durationHtml}
        <div class="card-cat-badge">${catLabel}</div>
        <div class="card-status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'ARSIP'}</div>
      </div>
    `;

    // Format label (cleaned)
    const formatLabel = p.format && p.format !== '—' ? p.format : '';

    card.innerHTML = `
      ${imgArea}
      <div class="card-body">
        <div class="card-title">${p.title}</div>
        <div class="card-schedule">
          <span class="card-schedule-icon">⏱</span>
          <span>${schedText}</span>
        </div>
        <p class="card-desc">${p.description}</p>
        <div class="card-footer">
          <button class="btn-detail-card" aria-label="Detail program ${p.title}">Detail Program</button>
          ${formatLabel ? `<span class="card-format-pill">${formatLabel.toUpperCase()}</span>` : ''}
        </div>
      </div>
    `;

    card.addEventListener('click', () => openModal(p.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(p.id); }
    });

    grid.appendChild(card);
  });

  // ─── Filter logic ─────────────────────────────────────────
  const filterBtns = document.querySelectorAll('.filter-tab');

  const applyFilter = (filter) => {
    // Re-sort DOM cards setiap kali filter berubah
    const allCards = [...document.querySelectorAll('.program-card')];
    allCards.sort((a, b) => {
      const score = (card) => {
        const isAktif = card.dataset.status === 'aktif';
        const hasImg  = card.dataset.hasImg === 'true';
        if  (isAktif &&  hasImg) return 0;
        if  (isAktif && !hasImg) return 1;
        if (!isAktif &&  hasImg) return 2;
        return 3;
      };
      return score(a) - score(b);
    });
    allCards.forEach(c => grid.appendChild(c));

    let delay = 0;
    document.querySelectorAll('.program-card').forEach(card => {
      let show = false;
      if (filter === 'semua') show = true;
      else if (filter === 'aktif') show = card.dataset.status === 'aktif';
      else if (filter === 'arsip') show = card.dataset.status === 'arsip';
      else show = card.dataset.category === filter;

      if (show) {
        card.classList.remove('hidden');
        card.style.animationDelay = `${delay * 30}ms`;
        card.style.animation = 'none';
        void card.offsetHeight;
        card.style.animation = '';
        delay++;
      } else {
        card.classList.add('hidden');
      }
    });

    const visible = document.querySelectorAll('.program-card:not(.hidden)').length;
    const emptyEl = document.getElementById('catalog-empty');
    if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
  };

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected','true');
      applyFilter(btn.dataset.filter);
    });
  });

  // ─── Modal ────────────────────────────────────────────────
  const overlay  = document.getElementById('program-modal');
  const modalBox = document.getElementById('modal-box');
  const closeBtn = document.getElementById('modal-close-btn');

  const openModal = (id) => {
    const p = programs.find(x => x.id === id);
    if (!p) return;

    const catLabel = catMap[p.category] || p.category.toUpperCase();
    const isAktif  = p.status === 'aktif';

    // Header style
    const head = document.getElementById('modal-head');
    if (head) head.className = `modal-head ${isAktif ? 'aktif' : 'arsip'}`;

    // Cat label
    const catEl = document.getElementById('modal-cat-label');
    if (catEl) catEl.textContent = catLabel;

    // Status badge
    const statusEl = document.getElementById('modal-status-badge');
    if (statusEl) {
      statusEl.className = `modal-status-badge ${isAktif ? 'aktif' : 'arsip'}`;
      statusEl.textContent = isAktif ? 'AKTIF' : 'ARSIP';
    }

    // Title & meta
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = p.title;

    const metaEl = document.getElementById('modal-meta');
    if (metaEl) metaEl.textContent = `Format: ${p.format} · Durasi: ${p.duration}`;

    // Thumbnail — tampilkan jika ada thumbnail_url
    const thumb = document.getElementById('modal-thumb');
    if (thumb) {
      if (p.thumbnail_url) {
        thumb.src = p.thumbnail_url;
        thumb.alt = p.title;
        thumb.style.display = 'block';
        thumb.onerror = () => { thumb.style.display = 'none'; };
      } else {
        thumb.style.display = 'none';
      }
    }

    // Video Bumper Promosi (YouTube Embed)
    const videoWrap   = document.getElementById('modal-video-wrap');
    const videoIframe = document.getElementById('modal-video-iframe');
    if (videoWrap && videoIframe) {
      if (p.promo_video_url) {
        let embedUrl = p.promo_video_url;
        if (embedUrl.includes('youtube.com/watch?v=')) {
          const vId = embedUrl.split('v=')[1]?.split('&')[0];
          embedUrl = `https://www.youtube.com/embed/${vId}?rel=0`;
        } else if (embedUrl.includes('youtu.be/')) {
          const vId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
          embedUrl = `https://www.youtube.com/embed/${vId}?rel=0`;
        } else if (!embedUrl.includes('/embed/')) {
          embedUrl = `https://www.youtube.com/embed/${embedUrl}?rel=0`;
        }
        videoIframe.src = embedUrl;
        videoWrap.style.display = 'block';
      } else {
        videoIframe.src = '';
        videoWrap.style.display = 'none';
      }
    }


    // Slots
    const slotKeys  = ['pagi', 'siang', 'malam'];
    const slotIcons = { pagi: '🌅', siang: '☀️', malam: '🌙' };
    const slotNames = { pagi: 'PAGI', siang: 'SIANG', malam: 'MALAM' };

    slotKeys.forEach(key => {
      const slotData = p.schedule[key];
      const el = document.getElementById(`slot-${key}`);
      if (!el) return;

      if (slotData?.active) {
        el.className = 'jadwal-slot aktif-slot';
        el.innerHTML = `
          <div class="slot-icon">${slotIcons[key]}</div>
          <div class="slot-nama">${slotData.label || slotNames[key]}</div>
          <div class="slot-waktu">${slotData.time || '—'}</div>
          <div class="slot-hari">${slotData.days || ''}</div>
        `;
      } else {
        el.className = 'jadwal-slot kosong-slot';
        el.innerHTML = `
          <div class="slot-icon">${slotIcons[key]}</div>
          <div class="slot-nama">${slotNames[key]}</div>
          <div class="slot-waktu">—</div>
          <div class="slot-hari">Tidak tayang</div>
        `;
      }
    });

    // Sinopsis
    const sinopsisEl = document.getElementById('modal-sinopsis');
    if (sinopsisEl) sinopsisEl.textContent = p.description;

    // CTA button
    const ctaBtn = document.getElementById('modal-cta');
    if (ctaBtn) {
      if (isAktif) {
        ctaBtn.style.display = 'flex';
        ctaBtn.onclick = () => window.open(p.youtube_live_url || LIVE_URL, '_blank', 'noopener,noreferrer');
      } else {
        ctaBtn.style.display = 'none';
      }
    }

    // Open
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (modalBox) modalBox.scrollTop = 0;
    closeBtn?.focus();
  };

  const closeModal = () => {
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
    const videoIframe = document.getElementById('modal-video-iframe');
    if (videoIframe) videoIframe.src = '';
  };

  // Expose to main.js (hero detail button)
  window.openProgramModal = openModal;

  // Event listeners
  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) closeModal();
  });

})();