// ============================================================
// RUAI TV — catalog.js  v3 (Pixel-perfect Figma)
// ============================================================

(async () => {

  const LIVE_URL = 'https://www.youtube.com/@livestreamingruaitelevisi5647/streams';
  let   programs = [];

  // ─── Load data (Supabase -> programs.json) ───────────────
  const esc = window.escapeHtml;

  if (window.RuaiSupabase && window.RuaiSupabase.getConfig().isConfigured) {
    try {
      const sbData = await window.RuaiSupabase.getPrograms();
      if (Array.isArray(sbData) && sbData.length > 0) {
        programs = sbData.map(p => ({
          ...p,
          schedule: p.schedule_json || p.schedule
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch failed in catalog.js:', e);
    }
  }

  // Fallback statis: programs.json
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
          <p style="font-size:14px;font-weight:600;margin-bottom:6px;">Data gagal dimuat</p>
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

  // ─── Counters (pil di header) ─────────────────────────────
  const isAktif = (p) => !!p && p.status === 'aktif';
  const counts = {
    aktif: programs.filter(isAktif).length,
    arsip: programs.filter(p => p && p.status === 'arsip').length,
  };

  const totalAktif = document.getElementById('total-aktif');
  const totalArsip = document.getElementById('total-arsip');
  if (totalAktif) totalAktif.textContent = counts.aktif;
  if (totalArsip) totalArsip.textContent = counts.arsip;

  // ─── Urutan program ───────────────────────────────────────
  // 1) Program aktif dulu, 2) paling sering tayang sepekan (dari jadwal admin),
  // 3) yang punya gambar. Sisanya mengikuti urutan data (sort bersifat stabil).
  const weeklyAirings = new Map(programs.filter(Boolean).map(p => [p.id, window.RuaiSchedule.countWeeklyAirings(p)]));
  programs.sort((a, b) => {
    if (isAktif(a) !== isAktif(b)) return isAktif(a) ? -1 : 1;
    const byAirings = (weeklyAirings.get(b?.id) || 0) - (weeklyAirings.get(a?.id) || 0);
    if (byAirings) return byAirings;
    return Number(!!b?.thumbnail_url) - Number(!!a?.thumbnail_url);
  });

  // ─── Hero: ikuti program unggulan ─────────────────────────
  // Program unggulan = urutan teratas katalog (aktif & paling sering tayang sepekan).
  // Banner-nya dipakai sebagai latar hero + kartu Prime Time; teksnya ikut programnya.
  const applyFeaturedHero = (p) => {
    window.RuaiFeaturedId = p.id;

    const titleEl = document.getElementById('primetime-title');
    const descEl  = document.getElementById('primetime-desc');
    if (titleEl) titleEl.textContent = p.title;
    if (descEl && p.description) descEl.textContent = p.description;

    document.getElementById('hero-detail-btn')?.setAttribute('aria-label', `Lihat detail program ${p.title}`);
    document.getElementById('hero-stream-btn')?.setAttribute('aria-label', `Streaming live ${p.title} di YouTube`);

    if (!p.thumbnail_url) return; // tanpa banner: hero tetap polos

    // Url absolut (var() di CSS memakai basis stylesheet, bukan halaman); dipasang hanya setelah gambar termuat
    let src;
    try { src = new URL(p.thumbnail_url, document.baseURI).href; } catch (e) { return; }
    const probe = new Image();
    probe.onload = () => {
      document.documentElement.style.setProperty('--hero-image', `url(${JSON.stringify(src)})`);
      document.getElementById('beranda')?.classList.add('has-hero-image');
    };
    probe.src = src;
  };

  const featuredProgram = programs.find(isAktif);
  if (featuredProgram) applyFeaturedHero(featuredProgram);

  // ─── Render cards ─────────────────────────────────────────
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  programs.forEach((p, idx) => {
    if (!p) return;
    const catLabel  = catMap[p.category] || (p.category ? p.category.toUpperCase() : 'PROGRAM');
    const active    = isAktif(p);
    const schedText = getScheduleText(p.schedule);

    // Card
    const card = document.createElement('article');
    card.className = `program-card${!active ? ' arsip-card hidden' : ''}`; // arsip tersembunyi sampai dibuka
    card.dataset.status   = p.status;
    card.dataset.category = p.category;
    card.dataset.id       = p.id;
    card.dataset.hasImg   = p.thumbnail_url ? 'true' : 'false';
    card.style.animationDelay = `${idx * 28}ms`;

    // Duration pill — show if not "—"
    const durationHtml = p.duration && p.duration !== '—'
      ? `<div class="card-duration-pill">${esc(p.duration)}</div>`
      : '';

    // Image area — tampilkan gambar jika ada thumbnail, jika tidak tampilkan placeholder abu-abu
    const badges = `
        ${durationHtml}
        <div class="card-cat-badge">${esc(catLabel)}</div>
        <div class="card-status-badge ${active ? 'aktif' : 'arsip'}">${active ? 'Aktif' : 'ARSIP'}</div>`;

    const imgArea = p.thumbnail_url ? `
      <div class="card-img-area">
        <img class="card-thumb" src="${esc(p.thumbnail_url)}" alt="${esc(p.title)}" width="320" height="150" loading="lazy" decoding="async" />
        ${badges}
      </div>
    ` : `
      <div class="card-img-area">
        <div class="card-no-thumb"><div class="card-circle-deco"></div></div>
        ${badges}
      </div>
    `;

    // Format label (cleaned)
    const formatLabel = p.format && p.format !== '—' ? p.format : '';

    card.innerHTML = `
      ${imgArea}
      <div class="card-body">
        <div class="card-title">${esc(p.title)}</div>
        <div class="card-schedule">
          <span class="card-schedule-icon">&#9650;</span>
          <span>${esc(schedText)}</span>
        </div>
        <p class="card-desc">${esc(p.description)}</p>
        <div class="card-footer">
          <button type="button" class="btn-detail-card" aria-label="Detail program ${esc(p.title)}">Detail Program</button>
          ${formatLabel ? `<span class="card-format-pill">${esc(formatLabel.toUpperCase())}</span>` : ''}
        </div>
      </div>
    `;

    const cardImg = card.querySelector('img.card-thumb');
    if (cardImg) {
      cardImg.addEventListener('error', () => {
        const area = cardImg.parentElement;
        area.innerHTML = `<div class="card-no-thumb"><div class="card-circle-deco"></div></div>${badges}`;
      }, { once: true });
    }

    // Seluruh kartu bisa diklik (mouse/sentuh); untuk keyboard, tombol "Detail Program" di dalamnya
    card.addEventListener('click', () => openModal(p.id));

    grid.appendChild(card);
  });

  // ─── Filter, Arsip & Search logic ─────────────────────────
  const filterBtns    = document.querySelectorAll('.filter-tab');
  const archiveWrap   = document.getElementById('archive-toggle-wrap');
  const archiveToggle = document.getElementById('archive-toggle');
  let currentCategoryFilter = 'semua';
  let currentSearchQuery    = '';
  let showArchive           = false;

  // Pemisah "Arsip Program" tepat sebelum kartu arsip pertama
  let archiveDivider = null;
  const firstArchiveCard = grid.querySelector('.program-card[data-status="arsip"]');
  if (firstArchiveCard) {
    archiveDivider = document.createElement('div');
    archiveDivider.className = 'archive-divider hidden';
    archiveDivider.textContent = 'Arsip Program';
    grid.insertBefore(archiveDivider, firstArchiveCard);
  }

  // Angka di tab = jumlah program yang memang bisa terlihat (aktif, + arsip bila dibuka)
  const refreshTabCounts = () => {
    const eligible = programs.filter(p => p && (showArchive || isAktif(p)));
    const byCat = (cat) => eligible.filter(p => p.category === cat).length;
    const tabCounts = { semua: eligible.length, berita: byCat('berita'), 'non-news': byCat('non-news'), 'kerja-sama': byCat('kerja-sama') };
    document.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.count;
      if (tabCounts[key] !== undefined) el.textContent = tabCounts[key];
    });
  };

  const refreshArchiveToggle = () => {
    if (!archiveToggle) return;
    archiveToggle.setAttribute('aria-expanded', String(showArchive));
    archiveToggle.querySelector('.archive-toggle-label').textContent = showArchive ? 'Sembunyikan Arsip' : 'Tampilkan Arsip';
    archiveToggle.querySelector('.archive-toggle-count').textContent = counts.arsip;
    if (archiveWrap) archiveWrap.hidden = counts.arsip === 0;
  };

  const applyCombinedFilter = () => {
    const query = currentSearchQuery.toLowerCase().trim();
    const searching = query.length > 0;

    let delay = 0;
    document.querySelectorAll('.program-card').forEach(card => {
      const progId = card.dataset.id;
      const prog   = programs.find(p => p && p.id === progId);

      const matchCat = currentCategoryFilter === 'semua' || card.dataset.category === currentCategoryFilter;

      // Arsip hanya tampil bila dibuka, atau saat mencari (supaya program arsip tetap bisa ditemukan)
      const matchStatus = card.dataset.status === 'aktif' || showArchive || searching;

      let matchSearch = true;
      if (searching && prog) {
        const titleMatch  = (prog.title || '').toLowerCase().includes(query);
        const descMatch   = (prog.description || '').toLowerCase().includes(query);
        const catMatch    = (prog.category || '').toLowerCase().includes(query);
        const catLblMatch = (prog.category_label || '').toLowerCase().includes(query);
        const formatMatch = (prog.format || '').toLowerCase().includes(query);
        matchSearch = titleMatch || descMatch || catMatch || catLblMatch || formatMatch;
      }

      const show = matchCat && matchStatus && matchSearch;

      if (show) {
        const wasHidden = card.classList.contains('hidden');
        card.classList.remove('hidden');
        if (wasHidden) {
          card.style.animationDelay = `${delay * 25}ms`;
          card.style.animation = 'none';
          void card.offsetHeight;
          card.style.animation = '';
        }
        delay++;
      } else {
        card.classList.add('hidden');
      }
    });

    archiveDivider?.classList.toggle('hidden', !document.querySelector('.program-card[data-status="arsip"]:not(.hidden)'));

    const visible = document.querySelectorAll('.program-card:not(.hidden)').length;
    const emptyEl = document.getElementById('catalog-empty');
    if (emptyEl) {
      emptyEl.style.display = visible === 0 ? 'block' : 'none';
      const textP = emptyEl.querySelector('p');
      if (textP) {
        if (visible === 0 && searching) {
          textP.textContent = `Tidak ada program yang cocok dengan pencarian "${currentSearchQuery}".`;
        } else if (visible === 0 && !showArchive && counts.arsip > 0) {
          textP.textContent = 'Belum ada program aktif untuk filter ini. Coba tampilkan arsip.';
        } else {
          textP.textContent = 'Tidak ada program untuk filter ini.';
        }
      }
    }
  };

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      currentCategoryFilter = btn.dataset.filter;
      applyCombinedFilter();
    });
  });

  archiveToggle?.addEventListener('click', () => {
    showArchive = !showArchive;
    refreshArchiveToggle();
    refreshTabCounts();
    applyCombinedFilter();
  });

  // Keadaan awal: hanya program aktif
  refreshArchiveToggle();
  refreshTabCounts();
  applyCombinedFilter();

  // Handle Navbar Search input via event delegation
  document.addEventListener('input', (e) => {
    if (e.target && (e.target.id === 'search-input' || e.target.id === 'mobile-search-input')) {
      currentSearchQuery = e.target.value;

      // Sync desktop & mobile search inputs
      const deskInput = document.getElementById('search-input');
      const mobInput  = document.getElementById('mobile-search-input');
      if (deskInput && deskInput !== e.target) deskInput.value = e.target.value;
      if (mobInput && mobInput !== e.target) mobInput.value = e.target.value;

      applyCombinedFilter();

      // Scroll to #program section smoothly if user starts typing
      if (currentSearchQuery.trim().length > 0) {
        const progSection = document.getElementById('program');
        if (progSection) {
          const navEl = document.getElementById('navbar');
          const navHeight = navEl ? navEl.offsetHeight : 0;
          const rect = progSection.getBoundingClientRect();
          if (rect.top > window.innerHeight * 0.7 || rect.bottom < 0) {
            const top = rect.top + window.scrollY - navHeight;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }
      }
    }
  });

  // Handle Enter key on search input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target && (e.target.id === 'search-input' || e.target.id === 'mobile-search-input')) {
      e.preventDefault();
      const progSection = document.getElementById('program');
      if (progSection) {
        const navEl = document.getElementById('navbar');
        const navHeight = navEl ? navEl.offsetHeight : 0;
        const top = progSection.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  });

  // ─── Modal ────────────────────────────────────────────────
  const overlay  = document.getElementById('program-modal');
  const modalBox = document.getElementById('modal-box');
  const closeBtn = document.getElementById('modal-close-btn');

  let lastFocusedBeforeModal = null;

  const openModal = (id) => {
    const p = programs.find(x => x.id === id);
    if (!p) return;

    const catLabel = catMap[p.category] || p.category.toUpperCase();
    const active   = isAktif(p);

    // Header style
    const head = document.getElementById('modal-head');
    if (head) head.className = `modal-head ${active ? 'aktif' : 'arsip'}`;

    // Cat label
    const catEl = document.getElementById('modal-cat-label');
    if (catEl) catEl.textContent = catLabel;

    // Status badge
    const statusEl = document.getElementById('modal-status-badge');
    if (statusEl) {
      statusEl.className = `modal-status-badge ${active ? 'aktif' : 'arsip'}`;
      statusEl.textContent = active ? 'AKTIF' : 'ARSIP';
    }

    // Title & meta
    const titleEl = document.getElementById('modal-title');
    if (titleEl) titleEl.textContent = p.title;

    const metaEl = document.getElementById('modal-meta');
    if (metaEl) metaEl.textContent = `Format: ${p.format} · Durasi: ${p.duration}`;

    // Media Display (Video Bumper atau Foto Banner)
    const thumb       = document.getElementById('modal-thumb');
    const videoWrap   = document.getElementById('modal-video-wrap');
    const videoIframe = document.getElementById('modal-video-iframe');

    const hasVideo = !!(p.promo_video_url);
    const hasThumb = !!(p.thumbnail_url);

    if (hasVideo && videoWrap && videoIframe) {
      let embedUrl = p.promo_video_url;
      if (embedUrl.includes('youtube.com/watch?v=')) {
        const vId = embedUrl.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${vId}?rel=0&autoplay=1`;
      } else if (embedUrl.includes('youtu.be/')) {
        const vId = embedUrl.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${vId}?rel=0&autoplay=1`;
      } else if (!embedUrl.includes('/embed/')) {
        embedUrl = `https://www.youtube.com/embed/${embedUrl}?rel=0&autoplay=1`;
      } else if (embedUrl.includes('/embed/') && !embedUrl.includes('autoplay')) {
        embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1';
      }
      let isYoutubeEmbed = false;
      try {
        const host = new URL(embedUrl).hostname;
        isYoutubeEmbed = host === 'www.youtube.com' || host === 'www.youtube-nocookie.com';
      } catch (e) {}

      if (!isYoutubeEmbed) {
        videoIframe.src = '';
        videoWrap.style.display = 'none';
      } else {
        videoIframe.src = embedUrl;
        videoWrap.style.display = 'block';
      }

      // Sembunyikan foto banner agar tidak menumpuk atas-bawah
      if (thumb) thumb.style.display = 'none';
    } else {
      if (videoWrap && videoIframe) {
        videoIframe.src = '';
        videoWrap.style.display = 'none';
      }
      if (thumb) {
        if (hasThumb) {
          thumb.src = p.thumbnail_url;
          thumb.alt = p.title;
          thumb.style.display = 'block';
          thumb.onerror = () => { thumb.style.display = 'none'; };
        } else {
          thumb.style.display = 'none';
        }
      }
    }


    // Slots
    const slotKeys  = ['pagi', 'siang', 'malam'];
    const slotNames = { pagi: 'PAGI', siang: 'SIANG', malam: 'MALAM' };

    slotKeys.forEach(key => {
      const slotData = p.schedule?.[key];
      const el = document.getElementById(`slot-${key}`);
      if (!el) return;

      if (slotData?.active) {
        el.className = 'jadwal-slot aktif-slot';
        el.innerHTML = `
          <div class="slot-nama">${esc(slotData.label || slotNames[key])}</div>
          <div class="slot-waktu">${esc(slotData.time || '—')}</div>
          <div class="slot-hari">${esc(slotData.days || '')}</div>
        `;
      } else {
        el.className = 'jadwal-slot kosong-slot';
        el.innerHTML = `
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
      if (active) {
        ctaBtn.style.display = 'flex';
        ctaBtn.onclick = () => window.open(p.youtube_live_url || LIVE_URL, '_blank', 'noopener,noreferrer');
      } else {
        ctaBtn.style.display = 'none';
      }
    }

    // Open
    lastFocusedBeforeModal = document.activeElement;
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (modalBox) modalBox.scrollTop = 0;
    // Overlay masih visibility:hidden di frame pertama transisi, jadi fokus ditunda dua frame
    requestAnimationFrame(() => requestAnimationFrame(() => closeBtn?.focus()));
  };

  const closeModal = () => {
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
    const videoIframe = document.getElementById('modal-video-iframe');
    if (videoIframe) videoIframe.src = '';
    lastFocusedBeforeModal?.focus?.();
    lastFocusedBeforeModal = null;
  };

  // Expose to main.js (hero detail button)
  window.openProgramModal = openModal;

  // Event listeners
  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => {
    if (!overlay?.classList.contains('open')) return;
    if (e.key === 'Escape') { closeModal(); return; }

    // Fokus keyboard tidak boleh keluar dari pop-up selama terbuka
    if (e.key === 'Tab') {
      const focusables = [...overlay.querySelectorAll('button, a[href], input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

})();