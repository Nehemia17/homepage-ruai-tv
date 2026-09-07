// ============================================================
// RUAI TV — catalog.js  v3 (Pixel-perfect Figma)
// ============================================================

(async () => {

  const LIVE_URL     = 'https://www.youtube.com/@ruaitv/live';
  const HERO_IMG     = 'assets/images/programs/Warta-Ruai.png';  // placeholder sementara
  let   programs     = [];

  // ─── Load data ────────────────────────────────────────────
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

  // ─── Category config ─────────────────────────────────────
  const catMap = {
    'berita':     'PROGRAM BERITA',
    'non-news':   'NON-NEWS',
    'kerja-sama': 'KERJA SAMA',
  };

  // ─── Format helpers ───────────────────────────────────────
  const getScheduleText = (schedule) => {
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
    aktif:        programs.filter(p => p.status === 'aktif').length,
    arsip:        programs.filter(p => p.status === 'arsip').length,
    berita:       programs.filter(p => p.category === 'berita').length,
    'non-news':   programs.filter(p => p.category === 'non-news').length,
    'kerja-sama': programs.filter(p => p.category === 'kerja-sama').length,
  };

  document.querySelectorAll('[data-count]').forEach(el => {
    const key = el.dataset.count;
    if (counts[key] !== undefined) el.textContent = counts[key];
  });

  const totalAktif = document.getElementById('total-aktif');
  const totalArsip = document.getElementById('total-arsip');
  if (totalAktif) totalAktif.textContent = counts.aktif;
  if (totalArsip) totalArsip.textContent = counts.arsip;

  // ─── Render cards ─────────────────────────────────────────
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  programs.forEach((p, idx) => {
    const catLabel  = catMap[p.category] || p.category.toUpperCase();
    const isAktif   = p.status === 'aktif';
    const schedText = getScheduleText(p.schedule);

    // Determine thumbnail: use actual if available, otherwise hero placeholder
    const thumbSrc = p.thumbnail_url || HERO_IMG;

    // Card
    const card = document.createElement('article');
    card.className = `program-card${!isAktif ? ' arsip-card' : ''}`;
    card.dataset.status   = p.status;
    card.dataset.category = p.category;
    card.dataset.id       = p.id;
    card.style.animationDelay = `${idx * 28}ms`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Lihat detail: ${p.title}`);

    // Duration pill — show if not "—"
    const durationHtml = p.duration && p.duration !== '—'
      ? `<div class="card-duration-pill">${p.duration}</div>`
      : '';

    // Image area — always show placeholder (HERO_IMG) until real image provided
    const imgArea = `
      <div class="card-img-area">
        <img
          class="card-thumb"
          src="${thumbSrc}"
          alt="${p.title}"
          loading="lazy"
          onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'card-no-thumb\\'><div class=\\'card-circle-deco\\'></div></div>${durationHtml.replace(/"/g,"'")}<div class=\\'card-cat-badge\\'>${catLabel}</div><div class=\\'card-status-badge ${isAktif ? 'aktif' : 'arsip'}\\'>${isAktif ? 'Aktif' : 'ARSIP'}</div>'"
        />
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

    // Thumbnail
    const thumb = document.getElementById('modal-thumb');
    if (thumb) {
      thumb.src = p.thumbnail_url || HERO_IMG;
      thumb.alt = p.title;
      thumb.style.display = 'block';
      thumb.onerror = () => { thumb.style.display = 'none'; };
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
