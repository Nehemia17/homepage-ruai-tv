/* ============================================================
   RUAI TV — Admin Panel Logic (admin.js)
   Backend: Supabase (Auth, Database, Storage)
   ============================================================ */

(() => {
  let programsData = [];
  const esc = window.escapeHtml;
  const icon = (name) => window.AdminUI.icon(name);
  const LOGIN_URL = '/admin/login.html';

  // ─── Initializer ───
  document.addEventListener('DOMContentLoaded', async () => {
    if (!(await checkAuthGuard())) return;
    initLogoutHandler();
    await loadPrograms();
    initDashboardStats();
    initProgramsTable();
    initModalHandlers();
    initFileUpload();
  });

  // ─── Auth Guard & Session ───
  // Sesi diverifikasi ke server Supabase (bukan sekadar flag di browser).
  async function checkAuthGuard() {
    const user = window.RuaiSupabase ? await window.RuaiSupabase.verifySession() : null;
    if (!user) {
      window.location.href = LOGIN_URL;
      return false;
    }
    const userEl = document.getElementById('admin-user-fullname');
    if (userEl) userEl.textContent = user.fullname || user.email;
    const profileEl = document.querySelector('.admin-profile');
    if (profileEl && user.email) profileEl.title = user.email;
    const avatarEl = document.querySelector('.admin-profile .avatar');
    if (avatarEl) avatarEl.textContent = (user.fullname || user.email || 'A').trim().charAt(0).toUpperCase();
    return true;
  }

  // Dipanggil saat request admin ditolak karena sesi habis / bukan admin
  function handleAuthFailure(err) {
    if (err && err.code === 'AUTH_REQUIRED') {
      showToast('Sesi login berakhir. Mengarahkan ke halaman login...', 'error');
      window.RuaiSupabase.clearSession();
      setTimeout(() => { window.location.href = LOGIN_URL; }, 1200);
      return true;
    }
    return false;
  }

  // ─── Logout Handler ───
  function initLogoutHandler() {
    const logoutBtns = document.querySelectorAll('.btn-admin-logout, #btn-logout');
    const doLogout = async () => {
      await window.RuaiSupabase.signOut();
      window.location.href = LOGIN_URL;
    };

    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Keluar dari Admin?',
            text: 'Anda perlu melakukan login kembali untuk mengakses panel pengelola.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#DC2626',
            cancelButtonColor: '#64748B',
            confirmButtonText: 'Ya, Logout',
            cancelButtonText: 'Batal',
            reverseButtons: true
          }).then((result) => {
            if (result.isConfirmed) doLogout();
          });
        } else if (confirm('Apakah Anda yakin ingin keluar dari Admin Panel?')) {
          doLogout();
        }
      });
    });
  }

  // ─── Load Programs Data (sumber tunggal: Supabase) ───
  async function loadPrograms() {
    const sbData = await window.RuaiSupabase.getPrograms();
    if (!Array.isArray(sbData)) {
      showToast('Gagal memuat data program dari Supabase. Muat ulang halaman.', 'error');
      programsData = [];
      return;
    }
    programsData = sbData.map(p => ({
      ...p,
      schedule: p.schedule_json || p.schedule
    }));
  }

  // Payload kolom tabel programs (tanpa field turunan seperti `schedule`)
  function toDbRow(p) {
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      category_label: p.category_label,
      status: p.status,
      format: p.format,
      duration: p.duration,
      description: p.description,
      thumbnail_url: p.thumbnail_url,
      promo_video_url: p.promo_video_url || null,
      youtube_live_url: p.youtube_live_url,
      schedule_json: p.schedule,
      featured: Boolean(p.featured),
      updated_at: new Date().toISOString()
    };
  }

  // ─── Dashboard Stats ───
  function initDashboardStats() {
    const totalEl  = document.getElementById('stat-total');
    const aktifEl  = document.getElementById('stat-aktif');
    const arsipEl  = document.getElementById('stat-arsip');
    const beritaEl = document.getElementById('stat-berita');

    if (!totalEl) return; // Not on dashboard page

    const total  = programsData.length;
    const aktif  = programsData.filter(p => p.status === 'aktif').length;
    const arsip  = programsData.filter(p => p.status === 'arsip').length;
    const berita = programsData.filter(p => p.category === 'berita').length;

    totalEl.textContent  = total;
    aktifEl.textContent  = aktif;
    arsipEl.textContent  = arsip;
    beritaEl.textContent = berita;

    renderRecentTable();
  }

  // ─── Thumbnail Helper for Admin Table ───
  function getInitials(title) {
    if (!title) return 'RT';
    const clean = title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.substring(0, 2).toUpperCase();
  }

  // Halaman admin ada di /admin/, jadi path relatif seperti "assets/images/..." harus
  // dijadikan path dari akar situs agar gambarnya ketemu.
  function resolveImgSrc(url) {
    const src = String(url || '').trim();
    if (!src || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) return src;
    return `/${src}`;
  }

  function getProgramThumbHtml(p) {
    const title = esc(p.title);
    if (p.thumbnail_url && p.thumbnail_url !== 'assets/images/programs/' && p.thumbnail_url !== 'null' && p.thumbnail_url !== '-') {
      const imgSrc = resolveImgSrc(p.thumbnail_url);
      return `<img src="${esc(imgSrc)}" alt="${title}" class="table-thumb" data-initials="${esc(getInitials(p.title))}" />`;
    }
    return `<div class="table-no-thumb" title="${title}"><div class="thumb-circle"></div><span class="thumb-initials">${esc(getInitials(p.title))}</span></div>`;
  }

  // Ganti gambar yang gagal dimuat dengan placeholder inisial (tanpa inline handler)
  function bindThumbFallbacks(root) {
    root.querySelectorAll('img.table-thumb').forEach(img => {
      img.addEventListener('error', () => {
        const box = document.createElement('div');
        box.className = 'table-no-thumb';
        box.title = img.alt;
        box.innerHTML = `<div class="thumb-circle"></div><span class="thumb-initials">${esc(img.dataset.initials)}</span>`;
        img.replaceWith(box);
      }, { once: true });
    });
  }

  function renderRecentTable() {
    const tbody = document.getElementById('recent-programs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recent = programsData.slice(0, 5);

    recent.forEach(p => {
      const tr = document.createElement('tr');
      const isAktif = p.status === 'aktif';
      tr.innerHTML = `
        <td>${getProgramThumbHtml(p)}</td>
        <td>
          <div class="program-title-cell">
            <span>${esc(p.title)}</span>
            <span class="program-slug-sub">ID: ${esc(p.id)}</span>
          </div>
        </td>
        <td data-label="Kategori"><span class="cat-pill">${esc((p.category || 'berita').toUpperCase())}</span></td>
        <td data-label="Status"><span class="status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'Arsip'}</span></td>
        <td data-label="Format">${esc(p.format || '—')}</td>
      `;
      tbody.appendChild(tr);
    });
    bindThumbFallbacks(tbody);
  }

  // ─── Programs Table Management ───
  function initProgramsTable() {
    const tbody = document.getElementById('programs-table-body');
    if (!tbody) return;

    renderProgramsTable();

    const searchInput  = document.getElementById('search-program');
    const filterStatus = document.getElementById('filter-status');
    const filterCat    = document.getElementById('filter-category');

    searchInput?.addEventListener('input', renderProgramsTable);
    filterStatus?.addEventListener('change', renderProgramsTable);
    filterCat?.addEventListener('change', renderProgramsTable);

    // Event delegation: id program dibaca dari data-id, bukan disisipkan ke string JS
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'toggle') window.toggleStatus(id);
      else if (btn.dataset.action === 'edit') window.openEditModal(id);
      else if (btn.dataset.action === 'delete') window.confirmDelete(id);
    });
  }

  function renderProgramsTable() {
    const tbody = document.getElementById('programs-table-body');
    if (!tbody) return;

    const query  = document.getElementById('search-program')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('filter-status')?.value || 'all';
    const cat    = document.getElementById('filter-category')?.value || 'all';

    const filtered = programsData.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)) || p.id.toLowerCase().includes(query);
      const matchStatus = status === 'all' || p.status === status;
      const matchCat    = cat === 'all' || p.category === cat;
      return matchSearch && matchStatus && matchCat;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #94A3B8;">
            Tidak ada program yang sesuai dengan filter.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(p => {
      const isAktif = p.status === 'aktif';
      const id = esc(p.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${getProgramThumbHtml(p)}</td>
        <td>
          <div class="program-title-cell">
            <span>${esc(p.title)}</span>
            <span class="program-slug-sub">Slug: ${esc(p.slug || p.id)}</span>
          </div>
        </td>
        <td data-label="Kategori"><span class="cat-pill">${esc((p.category || 'berita').toUpperCase())}</span></td>
        <td data-label="Format">${esc(p.format || '—')}</td>
        <td data-label="Status"><span class="status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'Arsip'}</span></td>
        <td data-label="Durasi">${esc(p.duration || '—')}</td>
        <td class="cell-actions">
          <div class="table-actions">
            <button type="button" class="btn-icon toggle" title="${isAktif ? 'Arsipkan program' : 'Aktifkan program'}" aria-label="${isAktif ? 'Arsipkan program' : 'Aktifkan program'}" data-action="toggle" data-id="${id}">
              ${icon(isAktif ? 'pause' : 'play')}
            </button>
            <button type="button" class="btn-icon edit" title="Edit Program" aria-label="Edit program" data-action="edit" data-id="${id}">
              ${icon('pencil')}
            </button>
            <button type="button" class="btn-icon delete" title="Hapus Program" aria-label="Hapus program" data-action="delete" data-id="${id}">
              ${icon('trash')}
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    bindThumbFallbacks(tbody);

    const countBadge = document.getElementById('program-count-badge');
    if (countBadge) countBadge.textContent = `${filtered.length} Program`;
  }

  // ─── Toggle Status Action ───
  window.toggleStatus = async (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    const nextStatus = p.status === 'aktif' ? 'arsip' : 'aktif';
    try {
      await window.RuaiSupabase.updateProgram(id, { status: nextStatus });
    } catch (err) {
      if (handleAuthFailure(err)) return;
      showToast(`Gagal mengubah status: ${err.message}`, 'error');
      return;
    }

    p.status = nextStatus;
    renderProgramsTable();
    initDashboardStats();
    showToast(`Status "${p.title}" diubah menjadi ${p.status.toUpperCase()}`, 'success');
  };

  // ─── Image Compression Helper (Target: WebP & <= 100KB) ───
  async function compressToWebPUnder100KB(canvas) {
    const MAX_BYTES = 100 * 1024; // 100 KB limit
    let quality = 0.85;
    let format = 'image/webp';
    let ext = 'webp';

    // Test WebP canvas support
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const isWebPSupported = testCanvas.toDataURL('image/webp').startsWith('data:image/webp');
    if (!isWebPSupported) {
      format = 'image/jpeg';
      ext = 'jpg';
    }

    let blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));

    // Iteratively reduce quality if file > 100KB
    while (blob && blob.size > MAX_BYTES && quality > 0.35) {
      quality -= 0.1;
      blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality));
    }

    // If still > 100KB, downscale canvas slightly while preserving 16:9 ratio
    let currentCanvas = canvas;
    while (blob && blob.size > MAX_BYTES && currentCanvas.width > 640) {
      const newWidth = Math.round(currentCanvas.width * 0.85);
      const newHeight = Math.round(currentCanvas.height * 0.85);
      const scaled = document.createElement('canvas');
      scaled.width = newWidth;
      scaled.height = newHeight;
      const ctx = scaled.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(currentCanvas, 0, 0, newWidth, newHeight);
      currentCanvas = scaled;
      quality = 0.80;
      blob = await new Promise(resolve => currentCanvas.toBlob(resolve, format, quality));
      while (blob && blob.size > MAX_BYTES && quality > 0.35) {
        quality -= 0.1;
        blob = await new Promise(resolve => currentCanvas.toBlob(resolve, format, quality));
      }
    }

    return {
      blob,
      ext,
      format: ext.toUpperCase(),
      sizeBytes: blob ? blob.size : 0,
      sizeKB: blob ? (blob.size / 1024).toFixed(1) : '0'
    };
  }

  // ─── Banner Preview UI Synchronizer ───
  function updateBannerPreview(url, meta = null) {
    const previewBox    = document.getElementById('banner-preview-box');
    const emptyDropzone = document.getElementById('banner-empty-dropzone');
    const previewImg    = document.getElementById('banner-preview-img');
    const thumbInput    = document.getElementById('form-thumb');
    const manualInput   = document.getElementById('form-thumb-manual');
    const badgeFormat   = document.getElementById('preview-badge-format');
    const badgeSize     = document.getElementById('preview-badge-size');
    const badgeRatio    = document.getElementById('preview-badge-ratio');

    if (!previewBox || !emptyDropzone) return;

    if (url && url.trim().length > 0) {
      const cleanUrl = url.trim();
      if (previewImg) previewImg.src = resolveImgSrc(cleanUrl);
      if (thumbInput) thumbInput.value = cleanUrl;
      if (manualInput) manualInput.value = cleanUrl;

      previewBox.style.display = 'flex';
      emptyDropzone.style.display = 'none';

      if (meta) {
        if (badgeRatio) badgeRatio.textContent = meta.ratio || '16:9';
        if (badgeFormat) badgeFormat.textContent = meta.format || 'WEBP';
        if (badgeSize) {
          badgeSize.textContent = meta.sizeKB ? `${meta.sizeKB} KB` : '≤ 100 KB';
          badgeSize.style.display = '';
        }
      } else {
        const isWebp = cleanUrl.toLowerCase().includes('.webp') || cleanUrl.startsWith('data:image/webp');
        if (badgeFormat) badgeFormat.textContent = isWebp ? 'WEBP' : 'BANNER';
        // Ukuran file tidak diketahui untuk banner lama; ukuran piksel dibaca dari gambar itu sendiri
        if (badgeSize) badgeSize.style.display = 'none';
        if (badgeRatio && previewImg) {
          badgeRatio.textContent = '…';
          previewImg.onload = () => {
            badgeRatio.textContent = `${previewImg.naturalWidth}×${previewImg.naturalHeight}`;
          };
        }
      }
    } else {
      if (previewImg) previewImg.src = '';
      if (thumbInput) thumbInput.value = '';
      if (manualInput) manualInput.value = '';

      previewBox.style.display = 'none';
      emptyDropzone.style.display = 'flex';
    }
  }

  // ─── Interactive Cropper Modal (16:9 terkunci atau bebas) ───
  const CROP_RATIO_LOCKED = 16 / 9;
  let cropperInstance = null;
  let cropObjectUrl = null; // URL sementara (blob:) untuk gambar dari domain lain

  // Cropper hanya bisa memotong gambar yang satu domain (atau berizin CORS). Gambar dari domain
  // lain diambil dulu sebagai blob — langsung bila CORS diizinkan, bila tidak lewat server
  // (/api/banner) — lalu dipakai lewat URL blob: yang pasti satu domain.
  async function prepareCropSource(url) {
    const src = resolveImgSrc(url);
    if (src.startsWith('data:') || src.startsWith('blob:')) return src;
    if (new URL(src, location.href).origin === location.origin) return src;
    showToast('Memuat gambar banner...', 'info');
    const blob = await window.RuaiSupabase.fetchBannerBlob(src);
    return URL.createObjectURL(blob);
  }

  function releaseCropObjectUrl() {
    if (cropObjectUrl) {
      URL.revokeObjectURL(cropObjectUrl);
      cropObjectUrl = null;
    }
  }
  let cropRatioMode = '16:9'; // '16:9' | 'free'

  function setCropRatio(mode) {
    cropRatioMode = mode === 'free' ? 'free' : '16:9';
    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
      const active = btn.dataset.ratio === cropRatioMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    const info = document.getElementById('crop-info-ratio');
    if (info) {
      info.textContent = cropRatioMode === 'free'
        ? 'Bebas (sesuai potongan Anda)'
        : '16:9 (Sesuai Card Ruai TV)';
    }
    // NaN = tanpa kunci rasio di Cropper.js
    cropperInstance?.setAspectRatio(cropRatioMode === 'free' ? NaN : CROP_RATIO_LOCKED);
  }

  function openCropModal(imageSrc) {
    const cropModal = document.getElementById('crop-modal');
    const cropImg   = document.getElementById('crop-stage-image');
    if (!cropModal || !cropImg) return;

    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    setCropRatio('16:9');
    releaseCropObjectUrl();
    if (imageSrc.startsWith('blob:')) cropObjectUrl = imageSrc;
    cropImg.src = imageSrc;
    cropModal.classList.add('active');

    const initInstance = () => {
      if (cropperInstance) cropperInstance.destroy();
      if (typeof Cropper !== 'undefined') {
        cropperInstance = new Cropper(cropImg, {
          aspectRatio: cropRatioMode === 'free' ? NaN : CROP_RATIO_LOCKED,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.95,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          responsive: true
        });
      }
    };

    cropImg.onload = initInstance;
    cropImg.onerror = () => {
      closeCropModal();
      showToast('Gambar tidak dapat dimuat untuk dipotong. Unggah ulang file gambar aslinya.', 'error');
    };
    if (cropImg.complete) {
      initInstance();
    }
  }

  function closeCropModal() {
    const cropModal = document.getElementById('crop-modal');
    if (cropModal) cropModal.classList.remove('active');
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
    releaseCropObjectUrl();
    const fileInput = document.getElementById('form-file-upload');
    if (fileInput) fileInput.value = '';
  }

  function initCropModalControls() {
    const closeBtn   = document.getElementById('crop-modal-close-btn');
    const cancelBtn  = document.getElementById('crop-cancel-btn');
    const applyBtn   = document.getElementById('crop-apply-btn');
    const zoomInBtn  = document.getElementById('crop-btn-zoom-in');
    const zoomOutBtn = document.getElementById('crop-btn-zoom-out');
    const rotLeftBtn = document.getElementById('crop-btn-rotate-left');
    const rotRightBtn= document.getElementById('crop-btn-rotate-right');
    const resetBtn   = document.getElementById('crop-btn-reset');

    closeBtn?.addEventListener('click', closeCropModal);
    cancelBtn?.addEventListener('click', closeCropModal);

    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
      btn.addEventListener('click', () => setCropRatio(btn.dataset.ratio));
    });

    zoomInBtn?.addEventListener('click', () => cropperInstance?.zoom(0.1));
    zoomOutBtn?.addEventListener('click', () => cropperInstance?.zoom(-0.1));
    rotLeftBtn?.addEventListener('click', () => cropperInstance?.rotate(-90));
    rotRightBtn?.addEventListener('click', () => cropperInstance?.rotate(90));
    resetBtn?.addEventListener('click', () => cropperInstance?.reset());

    applyBtn?.addEventListener('click', async () => {
      if (!cropperInstance) return;

      const btnLabel = document.getElementById('crop-btn-label');
      if (btnLabel) btnLabel.textContent = 'Mengompres & Menyimpan...';
      applyBtn.disabled = true;

      try {
        // 16:9 -> output baku 960 x 540. Bebas -> ikuti bentuk potongan,
        // sisi terpanjang dibatasi 1280 px (tidak pernah di-upscale).
        const isFree = cropRatioMode === 'free';
        const canvas = cropperInstance.getCroppedCanvas(isFree
          ? { maxWidth: 1280, maxHeight: 1280, imageSmoothingQuality: 'high' }
          : { width: 960, height: 540, imageSmoothingQuality: 'high' });

        const { blob, ext, format, sizeKB } = await compressToWebPUnder100KB(canvas);

        const baseSlug = (document.getElementById('form-slug')?.value.trim() ||
                          document.getElementById('form-title')?.value.trim() ||
                          'program-banner').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const cleanFileName = `${baseSlug}-${Date.now()}.${ext}`;

        showToast(`Mengunggah banner (${sizeKB} KB, ${format})...`, 'info');

        const publicUrl = await window.RuaiSupabase.uploadBanner(blob, cleanFileName);
        updateBannerPreview(publicUrl, { format, sizeKB, ratio: cropRatioMode === 'free' ? 'BEBAS' : '16:9' });
        showToast(`Banner berhasil diunggah (${sizeKB} KB, ${format})!`, 'success');

        closeCropModal();
      } catch (err) {
        if (handleAuthFailure(err)) return;
        showToast(`Gagal mengunggah banner: ${err.message}`, 'error');
      } finally {
        if (btnLabel) btnLabel.textContent = 'Terapkan & Kompres WebP';
        applyBtn.disabled = false;
      }
    });
  }

  // ─── File Upload Handler ───
  function initFileUpload() {
    const fileInput   = document.getElementById('form-file-upload');
    const dropzone    = document.getElementById('banner-empty-dropzone');
    const btnTrigger  = document.getElementById('btn-trigger-upload');
    const btnRecrop   = document.getElementById('btn-crop-existing');
    const btnRemove   = document.getElementById('btn-remove-thumb');
    const btnManual   = document.getElementById('btn-apply-manual-path');
    const inputManual = document.getElementById('form-thumb-manual');

    const triggerFileSelect = () => fileInput?.click();

    dropzone?.addEventListener('click', triggerFileSelect);
    btnTrigger?.addEventListener('click', triggerFileSelect);

    // Drag & Drop
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleSelectedFile(files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleSelectedFile(file);
    });

    function handleSelectedFile(file) {
      if (!file.type.startsWith('image/')) {
        showToast('Harap pilih file gambar (PNG, JPG, JPEG, WEBP).', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        openCropModal(evt.target.result);
      };
      reader.readAsDataURL(file);
    }

    btnRecrop?.addEventListener('click', async () => {
      const currentThumb = document.getElementById('form-thumb')?.value;
      if (!currentThumb) {
        triggerFileSelect();
        return;
      }
      btnRecrop.disabled = true;
      try {
        openCropModal(await prepareCropSource(currentThumb));
      } catch (err) {
        if (handleAuthFailure(err)) return;
        showToast(`Banner tidak dapat dimuat untuk dipotong ulang: ${err.message}`, 'error');
      } finally {
        btnRecrop.disabled = false;
      }
    });

    btnRemove?.addEventListener('click', () => {
      updateBannerPreview('');
      showToast('Gambar banner dihapus.', 'info');
    });

    btnManual?.addEventListener('click', () => {
      const path = inputManual?.value.trim() || '';
      if (path) {
        updateBannerPreview(path);
        showToast('Path banner diterapkan.', 'success');
      }
    });

    initCropModalControls();
  }

  // ─── Modal Handlers ───
  function initModalHandlers() {
    const modal       = document.getElementById('program-modal');
    const closeBtn    = document.getElementById('modal-close-btn');
    const cancelBtn   = document.getElementById('modal-cancel-btn');
    const programForm = document.getElementById('program-form');
    const btnAdd      = document.getElementById('btn-add-program');

    // Auto-check schedule slot when typing in time or days input
    ['pagi', 'siang', 'malam'].forEach(slot => {
      const timeInput = document.getElementById(`sched-${slot}-time`);
      const daysInput = document.getElementById(`sched-${slot}-days`);
      const chkBox    = document.getElementById(`sched-${slot}-active`);

      const autoCheck = () => {
        if (chkBox && (timeInput?.value.trim().length > 0 || daysInput?.value.trim().length > 0)) {
          chkBox.checked = true;
        }
      };

      timeInput?.addEventListener('input', autoCheck);
      daysInput?.addEventListener('input', autoCheck);
    });

    btnAdd?.addEventListener('click', () => openAddModal());
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    programForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProgramForm();
    });
  }

  function openAddModal() {
    const form = document.getElementById('program-form');
    if (!form) return;

    form.reset();
    document.getElementById('modal-title-text').textContent = 'Tambah Program Baru';
    document.getElementById('form-id-input').value = '';
    document.getElementById('form-status').value = 'aktif';
    document.getElementById('form-category').value = 'berita';

    // Reset Schedule inputs
    document.getElementById('sched-pagi-active').checked = false;
    document.getElementById('sched-pagi-time').value = '';
    document.getElementById('sched-pagi-days').value = '';
    document.getElementById('sched-siang-active').checked = false;
    document.getElementById('sched-siang-time').value = '';
    document.getElementById('sched-siang-days').value = '';
    document.getElementById('sched-malam-active').checked = false;
    document.getElementById('sched-malam-time').value = '';
    document.getElementById('sched-malam-days').value = '';

    // Reset Banner Preview
    updateBannerPreview('');

    const modal = document.getElementById('program-modal');
    modal?.classList.add('active');
  }

  window.openEditModal = (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    document.getElementById('modal-title-text').textContent = 'Edit Program';
    document.getElementById('form-id-input').value = p.id;
    document.getElementById('form-title').value = p.title || '';
    document.getElementById('form-slug').value = p.slug || p.id;
    document.getElementById('form-category').value = p.category || 'berita';
    document.getElementById('form-format').value = (p.format && p.format !== '—') ? p.format : '';
    document.getElementById('form-status').value = p.status || 'aktif';
    document.getElementById('form-duration').value = (p.duration && p.duration !== '—') ? p.duration : '';
    document.getElementById('form-promo-video').value = p.promo_video_url || '';
    document.getElementById('form-desc').value = p.description || '';

    // Populate Banner Preview
    updateBannerPreview(p.thumbnail_url || '');

    // Populate Schedule inputs
    const sched = p.schedule || {};
    document.getElementById('sched-pagi-active').checked = !!(sched.pagi?.active || sched.pagi?.time || sched.pagi?.days);
    document.getElementById('sched-pagi-time').value = sched.pagi?.time || '';
    document.getElementById('sched-pagi-days').value = sched.pagi?.days || '';

    document.getElementById('sched-siang-active').checked = !!(sched.siang?.active || sched.siang?.time || sched.siang?.days);
    document.getElementById('sched-siang-time').value = sched.siang?.time || '';
    document.getElementById('sched-siang-days').value = sched.siang?.days || '';

    document.getElementById('sched-malam-active').checked = !!(sched.malam?.active || sched.malam?.time || sched.malam?.days);
    document.getElementById('sched-malam-time').value = sched.malam?.time || '';
    document.getElementById('sched-malam-days').value = sched.malam?.days || '';

    const modal = document.getElementById('program-modal');
    modal?.classList.add('active');
  };

  function closeModal() {
    const modal = document.getElementById('program-modal');
    modal?.classList.remove('active');
  }

  async function saveProgramForm() {
    const idInput   = document.getElementById('form-id-input').value.trim();
    const title     = document.getElementById('form-title').value.trim();
    const slugRaw   = document.getElementById('form-slug').value.trim() || title;
    const slug      = slugRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `prog-${Date.now()}`;
    const cat       = document.getElementById('form-category').value;
    const format    = document.getElementById('form-format').value.trim();
    const status    = document.getElementById('form-status').value;
    const durationInput = document.getElementById('form-duration').value.trim();
    const duration  = durationInput.length > 0 ? durationInput : null;
    const thumbVal  = document.getElementById('form-thumb').value.trim();
    const thumb     = thumbVal.length > 0 ? thumbVal : null;
    const promoVideo= document.getElementById('form-promo-video').value.trim();
    const desc      = document.getElementById('form-desc').value.trim();

    const pagiTime  = document.getElementById('sched-pagi-time').value.trim();
    const pagiDays  = document.getElementById('sched-pagi-days').value.trim();
    const pagiActive= document.getElementById('sched-pagi-active').checked || (pagiTime.length > 0 || pagiDays.length > 0);

    const siangTime  = document.getElementById('sched-siang-time').value.trim();
    const siangDays  = document.getElementById('sched-siang-days').value.trim();
    const siangActive= document.getElementById('sched-siang-active').checked || (siangTime.length > 0 || siangDays.length > 0);

    const malamTime  = document.getElementById('sched-malam-time').value.trim();
    const malamDays  = document.getElementById('sched-malam-days').value.trim();
    const malamActive= document.getElementById('sched-malam-active').checked || (malamTime.length > 0 || malamDays.length > 0);

    const scheduleObj = {
      pagi: {
        active: pagiActive,
        label: 'PAGI',
        time: pagiTime || null,
        days: pagiDays || null
      },
      siang: {
        active: siangActive,
        label: 'SIANG',
        time: siangTime || null,
        days: siangDays || null
      },
      malam: {
        active: malamActive,
        label: 'MALAM',
        time: malamTime || null,
        days: malamDays || null
      }
    };

    if (!title) {
      showToast('Judul program tidak boleh kosong!', 'error');
      return;
    }

    const categoryLabel = cat === 'berita' ? 'Program Berita' : (cat === 'non-news' ? 'Non-News' : 'Kerja Sama');
    const isEdit = Boolean(idInput);
    let draft;

    if (isEdit) {
      const existing = programsData.find(x => x.id === idInput);
      if (!existing) {
        showToast('Program tidak ditemukan. Muat ulang halaman.', 'error');
        return;
      }
      draft = {
        ...existing,
        title,
        slug,
        category: cat,
        category_label: categoryLabel,
        format: format || null,
        status,
        duration,
        thumbnail_url: thumb,
        promo_video_url: promoVideo,
        description: desc,
        schedule: scheduleObj
      };
    } else {
      // id berasal dari slug; wajib unik agar tidak menimpa program lain
      const newId = slug;
      if (programsData.some(x => x.id === newId)) {
        showToast(`ID "${newId}" sudah dipakai program lain. Ubah slug terlebih dahulu.`, 'error');
        return;
      }
      draft = {
        id: newId,
        title,
        slug,
        category: cat,
        category_label: categoryLabel,
        status,
        format: format || null,
        duration,
        description: desc,
        thumbnail_url: thumb,
        promo_video_url: promoVideo,
        youtube_live_url: 'https://www.youtube.com/@livestreamingruaitelevisi5647/streams',
        schedule: scheduleObj,
        featured: false
      };
    }

    try {
      const saved = await window.RuaiSupabase.upsertProgram(toDbRow(draft));
      const stored = { ...draft, ...saved, schedule: saved.schedule_json || draft.schedule };
      if (isEdit) {
        programsData = programsData.map(x => (x.id === stored.id ? stored : x));
      } else {
        programsData.unshift(stored);
      }
    } catch (err) {
      if (handleAuthFailure(err)) return;
      showToast(`Gagal menyimpan program: ${err.message}`, 'error');
      return; // modal tetap terbuka agar input tidak hilang
    }

    closeModal();
    renderProgramsTable();
    initDashboardStats();
    showToast(`Program "${title}" berhasil disimpan!`, 'success');
  }

  // ─── Delete Action ───
  window.confirmDelete = async (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    const doDelete = async () => {
      try {
        await window.RuaiSupabase.deleteProgram(id);
      } catch (err) {
        if (handleAuthFailure(err)) return;
        showToast(`Gagal menghapus program: ${err.message}`, 'error');
        return;
      }

      programsData = programsData.filter(x => x.id !== id);
      renderProgramsTable();
      initDashboardStats();
      showToast(`Program "${p.title}" telah dihapus!`, 'success');
    };

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Hapus Program?',
        html: `Apakah Anda yakin ingin menghapus program <strong>"${esc(p.title)}"</strong>?<br><small style="color:#64748B;">Tindakan ini tidak dapat dibatalkan.</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#DC2626',
        cancelButtonColor: '#64748B',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        reverseButtons: true
      }).then((result) => {
        if (result.isConfirmed) {
          doDelete();
        }
      });
    } else {
      if (confirm(`Apakah Anda yakin ingin menghapus program "${p.title}"?`)) {
        doDelete();
      }
    }
  };

  // ─── Toast Helper ───
  function showToast(message, type = 'success') {
    if (typeof Swal !== 'undefined') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'bottom-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        background: '#0F172A',
        color: '#FFFFFF',
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });

      Toast.fire({
        icon: type === 'success' ? 'success' : (type === 'error' ? 'error' : 'info'),
        title: message
      });
      return;
    }

    // DOM Fallback
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '&#10003;' : '&#9888;'}</span>
      <span>${esc(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

})();
