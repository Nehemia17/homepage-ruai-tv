/* ============================================================
   RUAI TV — Admin Panel Logic (admin.js)
   ============================================================ */

(() => {
  let programsData = [];
  const STORAGE_KEY = 'ruai_tv_programs_data';

  // ─── Initializer ───
  document.addEventListener('DOMContentLoaded', async () => {
    await loadPrograms();
    initDashboardStats();
    initProgramsTable();
    initModalHandlers();
  });

  // ─── Load Programs Data ───
  async function loadPrograms() {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        programsData = JSON.parse(localData);
        console.log('Loaded programs from localStorage:', programsData.length);
        return;
      } catch (e) {
        console.warn('Failed to parse localStorage data, refetching JSON:', e);
      }
    }

    try {
      const res = await fetch('../assets/data/programs.json');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      programsData = await res.json();
      saveToStorage();
      console.log('Loaded programs from JSON:', programsData.length);
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

  function renderRecentTable() {
    const tbody = document.getElementById('recent-programs-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const recent = programsData.slice(0, 5);

    recent.forEach(p => {
      const tr = document.createElement('tr');
      const isAktif = p.status === 'aktif';
      tr.innerHTML = `
        <td>
          <img src="../${p.thumbnail_url || 'assets/images/programs/Warta-Ruai.png'}" alt="${p.title}" class="table-thumb" onerror="this.src='../assets/images/programs/Warta-Ruai.png'" />
        </td>
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
    if (!tbody) return; // Not on programs page

    renderProgramsTable();

    // Event listeners for search & filter
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
        <td>
          <img src="../${p.thumbnail_url || 'assets/images/programs/Warta-Ruai.png'}" alt="${p.title}" class="table-thumb" onerror="this.src='../assets/images/programs/Warta-Ruai.png'" />
        </td>
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

    // Update count badge if exists
    const countBadge = document.getElementById('program-count-badge');
    if (countBadge) countBadge.textContent = `${filtered.length} Program`;
  }

  // ─── Toggle Status Action ───
  window.toggleStatus = (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    p.status = p.status === 'aktif' ? 'arsip' : 'aktif';
    saveToStorage();
    renderProgramsTable();
    initDashboardStats();
    showToast(`Status "${p.title}" diubah menjadi ${p.status.toUpperCase()}`, 'success');
  };

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
    
    // Default preset values
    document.getElementById('form-status').value = 'aktif';
    document.getElementById('form-category').value = 'berita';

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

    const modal = document.getElementById('program-modal');
    modal?.classList.add('active');
  };

  function closeModal() {
    const modal = document.getElementById('program-modal');
    modal?.classList.remove('active');
  }

  function saveProgramForm() {
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

    if (!title) {
      showToast('Judul program tidak boleh kosong!', 'error');
      return;
    }

    if (idInput) {
      // Edit existing
      const p = programsData.find(x => x.id === idInput);
      if (p) {
        p.title = title;
        p.slug = slug;
        p.category = cat;
        p.category_label = cat === 'berita' ? 'Program Berita' : (cat === 'non-news' ? 'Non-News' : 'Kerja Sama');
        p.format = format;
        p.status = status;
        p.duration = duration;
        p.thumbnail_url = thumb;
        p.promo_video_url = promoVideo;
        p.description = desc;
        showToast(`Program "${title}" berhasil diperbarui!`, 'success');
      }
    } else {
      // Add new
      const newId = slug || `prog-${Date.now()}`;
      const newProg = {
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
        schedule: {
          pagi: { active: false, label: 'PAGI', time: null, days: null },
          siang: { active: false, label: 'SIANG', time: null, days: null },
          malam: { active: false, label: 'MALAM', time: null, days: null }
        },
        featured: false
      };
      programsData.unshift(newProg);
      showToast(`Program baru "${title}" berhasil ditambahkan!`, 'success');
    }

    saveToStorage();
    closeModal();
    renderProgramsTable();
    initDashboardStats();
  }

  // ─── Delete Action ───
  window.confirmDelete = (id) => {
    const p = programsData.find(x => x.id === id);
    if (!p) return;

    if (confirm(`Apakah Anda yakin ingin menghapus program "${p.title}"?`)) {
      programsData = programsData.filter(x => x.id !== id);
      saveToStorage();
      renderProgramsTable();
      initDashboardStats();
      showToast(`Program "${p.title}" telah dihapus!`, 'success');
    }
  };

  // ─── Toast Notification Helper ───
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
