/* ============================================================
   RUAI TV — Admin Panel Logic (admin.js)
   Backend & MySQL REST API Integrated
   ============================================================ */

(() => {
  let programsData = [];
  const STORAGE_KEY = 'ruai_tv_programs_data';
  const API_URL = '../api/programs.php';
  const UPLOAD_URL = '../api/upload.php';

  // ─── Initializer ───
  document.addEventListener('DOMContentLoaded', async () => {
    await loadPrograms();
    initDashboardStats();
    initProgramsTable();
    initModalHandlers();
    initFileUpload();
  });

  // ─── Load Programs Data ───
  async function loadPrograms() {
    // 1. Try MySQL REST API (Relative & XAMPP Apache Endpoints)
    const apiEndpoints = [
      API_URL,
      'http://localhost/Homepage%20Statis%20Ruai-TV/api/programs.php',
      'http://localhost/api/programs.php'
    ];

    for (const ep of apiEndpoints) {
      try {
        const res = await fetch(ep);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const apiData = await res.json();
          if (Array.isArray(apiData) && apiData.length > 0) {
            programsData = apiData;
            saveToStorage();
            console.log('Loaded programs from MySQL API:', programsData.length);
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Fallback to localStorage
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        programsData = JSON.parse(localData);
        console.log('Loaded programs from localStorage:', programsData.length);
        return;
      } catch (e) {
        console.warn('Failed to parse localStorage:', e);
      }
    }

    // 3. Fallback to programs.json
    try {
      const res = await fetch('../assets/data/programs.json');
      if (res.ok) {
        programsData = await res.json();
        saveToStorage();
        console.log('Loaded programs from programs.json:', programsData.length);
      }
    } catch (err) {
      console.error('Error loading programs.json:', err);
      showToast('Gagal memuat data program.', 'error');
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(programsData));
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

  function getProgramThumbHtml(p) {
    if (p.thumbnail_url && p.thumbnail_url !== 'assets/images/programs/' && p.thumbnail_url !== 'null' && p.thumbnail_url !== '-') {
      let imgSrc = p.thumbnail_url.trim();
      if (!imgSrc.startsWith('data:') && !imgSrc.startsWith('http://') && !imgSrc.startsWith('https://') && !imgSrc.startsWith('/')) {
        imgSrc = `../${imgSrc}`;
      }
      return `<img src="${imgSrc}" alt="${p.title}" class="table-thumb" onerror="this.onerror=null;this.outerHTML='<div class=\\'table-no-thumb\\' title=\\'${p.title.replace(/'/g, "\\'")}\\'><div class=\\'thumb-circle\\'></div><span class=\\'thumb-initials\\'>${getInitials(p.title)}</span></div>';" />`;
    }
    const initials = getInitials(p.title);
    return `<div class="table-no-thumb" title="${p.title}"><div class="thumb-circle"></div><span class="thumb-initials">${initials}</span></div>`;
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
            <span>${p.title}</span>
            <span class="program-slug-sub">ID: ${p.id}</span>
          </div>
        </td>
        <td><span class="cat-pill">${(p.category || 'berita').toUpperCase()}</span></td>
        <td><span class="status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'Arsip'}</span></td>
        <td>${p.format || '—'}</td>
      `;
      tbody.appendChild(tr);
    });
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
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${getProgramThumbHtml(p)}</td>
        <td>
          <div class="program-title-cell">
            <span>${p.title}</span>
            <span class="program-slug-sub">Slug: ${p.slug || p.id}</span>
          </div>
        </td>
        <td><span class="cat-pill">${(p.category || 'berita').toUpperCase()}</span></td>
        <td>${p.format || '—'}</td>
        <td><span class="status-badge ${isAktif ? 'aktif' : 'arsip'}">${isAktif ? 'Aktif' : 'Arsip'}</span></td>
        <td>${p.duration || '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon toggle" title="Ubah Status (Aktif/Arsip)" onclick="window.toggleStatus('${p.id}')">
              ${isAktif ? '⏸' : '▶'}
            </button>
            <button class="btn-icon edit" title="Edit Program" onclick="window.openEditModal('${p.id}')">
              ✏️
            </button>
            <button class="btn-icon delete" title="Hapus Program" onclick="window.confirmDelete('${p.id}')">
              🗑️
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const countBadge = document.getElementById('program-count-badge');
    if (countBadge) countBadge.textContent = `${filtered.length} Program`;
  }

  // ─── Toggle Status Action ───
  window.toggleStatus = async (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    p.status = p.status === 'aktif' ? 'arsip' : 'aktif';
    saveToStorage();
    renderProgramsTable();
    initDashboardStats();

    // Sync to MySQL API if online
    try {
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
    } catch (e) {}

    showToast(`Status "${p.title}" diubah menjadi ${p.status.toUpperCase()}`, 'success');
  };

  // ─── File Upload Handler ───
  function initFileUpload() {
    const fileInput = document.getElementById('form-file-upload');
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('banner_file', file);

      showToast('Mengunggah file banner...', 'success');

      // Endpoints to try (Relative path first, then XAMPP Apache fallbacks)
      const uploadEndpoints = [
        UPLOAD_URL,
        'http://localhost/Homepage%20Statis%20Ruai-TV/api/upload.php',
        'http://localhost/api/upload.php'
      ];

      let uploadSuccess = false;

      for (const endpoint of uploadEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            body: formData
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const result = await res.json();
            if (result.status === 'success') {
              document.getElementById('form-thumb').value = result.url;
              showToast('Gambar banner berhasil diunggah ke server PHP/XAMPP!', 'success');
              uploadSuccess = true;
              break;
            }
          }
        } catch (err) {
          // Ignore and try next endpoint
        }
      }

      // If PHP server is not active on any endpoint, fallback to FileReader (Base64 Data URL)
      if (!uploadSuccess) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.getElementById('form-thumb').value = evt.target.result;
          showToast('Gambar banner berhasil dimuat!', 'success');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ─── Modal Handlers ───
  function initModalHandlers() {
    const modal       = document.getElementById('program-modal');
    const closeBtn    = document.getElementById('modal-close-btn');
    const cancelBtn   = document.getElementById('modal-cancel-btn');
    const programForm = document.getElementById('program-form');
    const btnAdd      = document.getElementById('btn-add-program');

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
    document.getElementById('form-format').value = p.format || '—';
    document.getElementById('form-status').value = p.status || 'aktif';
    document.getElementById('form-duration').value = p.duration || '—';
    document.getElementById('form-thumb').value = p.thumbnail_url || '';
    document.getElementById('form-promo-video').value = p.promo_video_url || '';
    document.getElementById('form-desc').value = p.description || '';

    // Populate Schedule inputs
    const sched = p.schedule || {};
    document.getElementById('sched-pagi-active').checked = !!(sched.pagi?.active);
    document.getElementById('sched-pagi-time').value = sched.pagi?.time || '';
    document.getElementById('sched-pagi-days').value = sched.pagi?.days || '';

    document.getElementById('sched-siang-active').checked = !!(sched.siang?.active);
    document.getElementById('sched-siang-time').value = sched.siang?.time || '';
    document.getElementById('sched-siang-days').value = sched.siang?.days || '';

    document.getElementById('sched-malam-active').checked = !!(sched.malam?.active);
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
    const slug      = document.getElementById('form-slug').value.trim() || title.toLowerCase().replace(/\s+/g, '-');
    const cat       = document.getElementById('form-category').value;
    const format    = document.getElementById('form-format').value.trim();
    const status    = document.getElementById('form-status').value;
    const duration  = document.getElementById('form-duration').value.trim();
    const thumb     = document.getElementById('form-thumb').value.trim() || 'assets/images/programs/Warta-Ruai.png';
    const promoVideo= document.getElementById('form-promo-video').value.trim();
    const desc      = document.getElementById('form-desc').value.trim();

    const scheduleObj = {
      pagi: {
        active: document.getElementById('sched-pagi-active').checked,
        label: 'PAGI',
        time: document.getElementById('sched-pagi-time').value.trim() || null,
        days: document.getElementById('sched-pagi-days').value.trim() || null
      },
      siang: {
        active: document.getElementById('sched-siang-active').checked,
        label: 'SIANG',
        time: document.getElementById('sched-siang-time').value.trim() || null,
        days: document.getElementById('sched-siang-days').value.trim() || null
      },
      malam: {
        active: document.getElementById('sched-malam-active').checked,
        label: 'MALAM',
        time: document.getElementById('sched-malam-time').value.trim() || null,
        days: document.getElementById('sched-malam-days').value.trim() || null
      }
    };

    if (!title) {
      showToast('Judul program tidak boleh kosong!', 'error');
      return;
    }

    let isEdit = false;
    let targetProg = null;

    if (idInput) {
      isEdit = true;
      targetProg = programsData.find(x => x.id === idInput);
      if (targetProg) {
        targetProg.title = title;
        targetProg.slug = slug;
        targetProg.category = cat;
        targetProg.category_label = cat === 'berita' ? 'Program Berita' : (cat === 'non-news' ? 'Non-News' : 'Kerja Sama');
        targetProg.format = format;
        targetProg.status = status;
        targetProg.duration = duration;
        targetProg.thumbnail_url = thumb;
        targetProg.promo_video_url = promoVideo;
        targetProg.description = desc;
        targetProg.schedule = scheduleObj;
      }
    } else {
      const newId = slug || `prog-${Date.now()}`;
      targetProg = {
        id: newId,
        title: title,
        slug: slug,
        category: cat,
        category_label: cat === 'berita' ? 'Program Berita' : (cat === 'non-news' ? 'Non-News' : 'Kerja Sama'),
        status: status,
        format: format || '—',
        duration: duration || '—',
        description: desc,
        thumbnail_url: thumb,
        promo_video_url: promoVideo,
        youtube_live_url: 'https://www.youtube.com/@ruaitv/live',
        schedule: scheduleObj,
        featured: false
      };
      programsData.unshift(targetProg);
    }

    saveToStorage();
    closeModal();
    renderProgramsTable();
    initDashboardStats();

    // Sync to MySQL API
    try {
      const res = await fetch(API_URL, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetProg)
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        showToast(`Program "${title}" berhasil disimpan di MySQL Database!`, 'success');
        return;
      }
    } catch (e) {
      console.log('MySQL API offline, saved to local storage:', e.message);
    }

    showToast(`Program "${title}" berhasil disimpan!`, 'success');
  }

  // ─── Delete Action ───
  window.confirmDelete = async (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    if (confirm(`Apakah Anda yakin ingin menghapus program "${p.title}"?`)) {
      programsData = programsData.filter(x => x.id !== id);
      saveToStorage();
      renderProgramsTable();
      initDashboardStats();

      // Sync to MySQL API
      try {
        await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      } catch (e) {}

      showToast(`Program "${p.title}" telah dihapus!`, 'success');
    }
  };

  // ─── Toast Helper ───
  function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : '⚠️'}</span>
      <span>${message}</span>
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
