/* ============================================================
   RUAI TV — Halaman Sistem Backend (system.js)
   Memantau Supabase (database, login) dan bucket banner: database, storage, login admin, perlindungan
   data, dan kesehatan data program. Semua pemeriksaan bersifat
   baca-saja. Pemeriksaan login/logout ditangani admin.js.
   ============================================================ */

(() => {
  const esc = window.escapeHtml;
  const S = window.RuaiSupabase;
  const icon = (name) => window.AdminUI.icon(name);
  const $ = (id) => document.getElementById(id);

  const STATE = {
    ok:      { label: 'Normal',          icon: 'circle-check',   cls: 'ok' },
    warn:    { label: 'Perlu perhatian', icon: 'triangle-alert', cls: 'warn' },
    fail:    { label: 'Bermasalah',      icon: 'circle-x',       cls: 'fail' },
    pending: { label: 'Memeriksa…',      icon: 'loader',         cls: 'pending' },
  };

  // ─── Util ───
  const timed = async (fn) => {
    const t0 = performance.now();
    try {
      const value = await fn();
      return { ok: true, ms: Math.round(performance.now() - t0), value };
    } catch (error) {
      return { ok: false, ms: Math.round(performance.now() - t0), error };
    }
  };

  const formatDateTime = (date) =>
    date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const maskKey = (key) => (key ? `${key.slice(0, 14)}••••••••` : '—');

  const projectRef = (url) => {
    try { return new URL(url).hostname.split('.')[0]; } catch (e) { return ''; }
  };

  // Gambar dimuat lewat <img> (bukan fetch) supaya pemeriksaan tetap jalan untuk gambar di
  // domain lain (bucket IDCloudHost) tanpa perlu CORS. Hanya tahu "termuat" atau "gagal".
  const probeImage = (src, timeoutMs = 12000) => new Promise((resolve) => {
    const img = new Image();
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = src;
  });

  const isBucketMode = () => S.getConfig().bannerStorage === 'bucket';

  // ─── Kartu ringkasan ───
  const setCard = (id, state, value, sub) => {
    const card = $(id);
    if (!card) return;
    const s = STATE[state];
    card.querySelector('[data-role="value"]').textContent = value || s.label;
    card.querySelector('[data-role="sub"]').textContent = sub || ' ';
    const iconBox = card.querySelector('[data-role="icon"]');
    iconBox.className = `stat-icon ${s.cls}`;
  };

  // ─── Daftar pemeriksaan ───
  const renderChecks = (listId, items) => {
    const list = $(listId);
    list.innerHTML = '';
    items.forEach(({ state, title, detail, meta }) => {
      const li = document.createElement('li');
      li.className = 'check-item';
      li.innerHTML = `
        <span class="check-ico ${STATE[state].cls}">${icon(STATE[state].icon)}</span>
        <div class="check-text">
          <strong>${esc(title)}</strong>
          ${detail ? `<span>${esc(detail)}</span>` : ''}
        </div>
        ${meta ? `<span class="check-meta">${esc(meta)}</span>` : ''}
      `;
      list.appendChild(li);
    });
  };

  // ─── Konfigurasi (tanpa menampilkan token apa pun) ───
  const renderConfig = (lastUpdate) => {
    const cfg = S.getConfig();
    const session = S.getSession();
    const rows = [
      ['Project Supabase', projectRef(cfg.url) || '—'],
      ['Alamat API', cfg.url || '—'],
      ['Penyimpanan banner baru', isBucketMode() ? 'Bucket IDCloudHost (lewat /api/banner)' : `Supabase Storage "${cfg.bucket}"`],
      ['Banner lama', `Supabase Storage "${cfg.bucket}"`],
      ['Kunci publik (anon)', maskKey(cfg.key)],
      ['Akun admin', session?.user?.email || '—'],
      ['Peran', session?.user?.role || '—'],
      ['Sesi login berakhir', session ? formatDateTime(new Date(session.expires_at * 1000)) : '—'],
      ['Perubahan data terakhir', lastUpdate ? formatDateTime(lastUpdate) : '—'],
    ];
    const dl = $('sys-config');
    dl.innerHTML = '';
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'kv-row';
      row.innerHTML = `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;
      dl.appendChild(row);
    });

    const link = $('link-supabase');
    const ref = projectRef(cfg.url);
    if (link && ref) link.href = `https://supabase.com/dashboard/project/${encodeURIComponent(ref)}`;
  };

  // ─── Pemeriksaan ───
  const checkDatabase = () => timed(async () => {
    const { url } = S.getConfig();
    const res = await fetch(`${url}/rest/v1/programs?select=id&limit=1`, { headers: S.getHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // Uji proteksi tulis: kirim baris tanpa "title" memakai kunci publik.
  // Kalau RLS aktif: ditolak (42501). Kalau RLS terbuka: ditolak constraint NOT NULL (23502) — tetap tidak ada data yang tertulis.
  const checkWriteGuard = () => timed(async () => {
    const { url } = S.getConfig();
    const res = await fetch(`${url}/rest/v1/programs`, {
      method: 'POST',
      headers: S.getHeaders(),
      body: JSON.stringify({ id: '__sys_probe__' }),
    });
    let code = '';
    try { code = (await res.json()).code || ''; } catch (e) {}

    if (res.status === 201) {
      // Seharusnya mustahil (title wajib diisi); bila terjadi, bersihkan dan laporkan sebagai masalah.
      await S.deleteProgram('__sys_probe__').catch(() => {});
      return { protected: false, note: 'Penulisan publik diterima' };
    }
    if (res.status === 401 || res.status === 403 || code === '42501') return { protected: true };
    if (code === '23502') return { protected: false, note: 'Penulisan publik tidak diblokir (RLS terbuka)' };
    return { protected: null, note: `Respons tak terduga (HTTP ${res.status})` };
  });

  // Mode "bucket": server (Vercel Function) mengecek bucket dengan kuncinya, lalu browser
  // memuat satu gambar publik sebagai contoh. Mode "supabase": cukup gambar contoh.
  const checkStorage = (programs) => timed(async () => {
    const { url } = S.getConfig();
    let info = null;
    if (isBucketMode()) {
      info = await S.bannerStorageStatus();
      if (!info.ok) throw new Error(info.detail);
    }
    const prefix = info && info.public_base_url ? info.public_base_url + '/' : `${url}/storage/`;
    const sample = (programs || []).find(p => p.thumbnail_url && p.thumbnail_url.startsWith(prefix));
    if (!sample) return { skipped: true, info };
    if (!(await probeImage(sample.thumbnail_url))) {
      throw new Error('gambar contoh tidak termuat; periksa akses baca publik (bucket policy)');
    }
    return { skipped: false, info };
  });

  // ─── Kesehatan data ───
  const listTitles = (items, max = 4) => {
    const names = items.slice(0, max).map(p => p.title);
    return names.join(', ') + (items.length > max ? `, dan ${items.length - max} lainnya` : '');
  };

  const buildHealth = (programs) => {
    const { url } = S.getConfig();
    const active = programs.filter(p => p.status === 'aktif');
    const archived = programs.filter(p => p.status === 'arsip');
    const noBanner = active.filter(p => !p.thumbnail_url);
    const localBanner = programs.filter(p => p.thumbnail_url && !/^https?:\/\//i.test(p.thumbnail_url));
    const noSchedule = active.filter(p => window.RuaiSchedule.getEntries(p.schedule_json ? { schedule: p.schedule_json } : p).length === 0);

    return [
      {
        state: 'ok', title: `${programs.length} program tersimpan`,
        detail: `${active.length} aktif, ${archived.length} arsip`,
      },
      noBanner.length === 0
        ? { state: 'ok', title: 'Semua program aktif punya banner' }
        : { state: 'warn', title: `${noBanner.length} program aktif belum punya banner`, detail: listTitles(noBanner) },
      localBanner.length === 0
        ? { state: 'ok', title: 'Semua banner tersimpan di penyimpanan cloud' }
        : { state: 'warn', title: `${localBanner.length} banner masih berupa file lokal`, detail: `${listTitles(localBanner)}. Unggah ulang lewat Kelola Program agar otomatis dikompres (WebP ≤100 KB) dan disimpan di cloud.` },
      noSchedule.length === 0
        ? { state: 'ok', title: 'Semua program aktif punya jadwal tayang yang terbaca' }
        : { state: 'warn', title: `${noSchedule.length} program aktif tidak muncul di Jadwal Sepekan`, detail: `${listTitles(noSchedule)}. Isi jam (mis. 19.00 – 20.00 WIB) dan hari (mis. Senin - Sabtu) pada slot jadwalnya.` },
    ];
  };

  // ─── Periksa gambar banner (HEAD ke setiap gambar, 6 sekaligus) ───
  const checkImages = async (programs) => {
    const box = $('sys-images');
    const btn = $('btn-check-images');
    const withImg = programs.filter(p => p.thumbnail_url);
    box.hidden = false;
    box.textContent = `Memeriksa ${withImg.length} gambar…`;
    btn.disabled = true;

    const broken = [];
    let done = 0;
    const queue = [...withImg];
    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        let ok = false;
        try {
          ok = await probeImage(new URL(p.thumbnail_url, location.origin + '/').href);
        } catch (e) { ok = false; }
        if (!ok) broken.push({ title: p.title, status_label: p.status });
        done += 1;
        box.textContent = `Memeriksa gambar… ${done}/${withImg.length}`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    btn.disabled = false;
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'sys-images-head';
    head.innerHTML = broken.length === 0
      ? `<span class="check-ico ok">${icon('circle-check')}</span><strong>Semua ${withImg.length} gambar dapat dimuat.</strong>`
      : `<span class="check-ico warn">${icon('triangle-alert')}</span><strong>${broken.length} dari ${withImg.length} gambar tidak dapat dimuat</strong>`;
    box.appendChild(head);

    if (broken.length) {
      const ul = document.createElement('ul');
      ul.className = 'check-list';
      broken.forEach(b => {
        const li = document.createElement('li');
        li.className = 'check-item';
        li.innerHTML = `<div class="check-text"><strong>${esc(b.title)}</strong><span>${b.status_label === 'arsip' ? 'Program arsip' : 'Program aktif'} · gambar tidak dapat dimuat. Unggah banner baru lewat Kelola Program.</span></div>`;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
  };

  // ─── Jalankan semua pemeriksaan ───
  let latestPrograms = [];
  let running = false;

  const runChecks = async () => {
    if (running) return;
    running = true;
    const recheck = $('btn-recheck');
    recheck.disabled = true;
    recheck.classList.add('is-busy');
    $('sys-images').hidden = true;

    ['sys-db', 'sys-storage', 'sys-auth', 'sys-guard'].forEach(id => setCard(id, 'pending'));
    renderChecks('sys-security', [{ state: 'pending', title: 'Memeriksa…' }]);
    renderChecks('sys-health', [{ state: 'pending', title: 'Memeriksa…' }]);

    const [db, programsResult, auth, guard] = await Promise.all([
      checkDatabase(),
      timed(() => S.getPrograms()),
      timed(() => S.verifySession()),
      checkWriteGuard(),
    ]);

    // Database
    if (db.ok) setCard('sys-db', db.ms > 1500 ? 'warn' : 'ok', null, `Merespons dalam ${db.ms} ms`);
    else setCard('sys-db', 'fail', null, `Tidak dapat dihubungi (${db.error.message})`);

    // Data program
    const programs = programsResult.ok && Array.isArray(programsResult.value) ? programsResult.value : null;
    latestPrograms = programs || [];

    // Login admin
    const user = auth.ok ? auth.value : null;
    if (user) setCard('sys-auth', 'ok', null, `${user.email} · ${user.role}`);
    else setCard('sys-auth', 'fail', null, 'Sesi tidak valid; silakan login ulang');

    // Perlindungan data
    const g = guard.ok ? guard.value : null;
    if (g && g.protected === true) setCard('sys-guard', 'ok', 'Terlindungi', 'Penulisan tanpa login ditolak');
    else if (g && g.protected === false) setCard('sys-guard', 'fail', null, g.note);
    else setCard('sys-guard', 'warn', null, g ? g.note : 'Uji tidak dapat dijalankan');

    // Storage (butuh daftar program untuk memilih gambar contoh)
    const storage = await checkStorage(programs);
    const where = isBucketMode() ? 'Bucket IDCloudHost' : 'Supabase Storage';
    if (!storage.ok) setCard('sys-storage', 'fail', null, `${where} bermasalah (${storage.error.message})`);
    else if (storage.value.skipped && isBucketMode()) setCard('sys-storage', 'ok', null, `${where} terhubung · belum ada banner diunggah ke sana`);
    else if (storage.value.skipped) setCard('sys-storage', 'warn', 'Belum dipakai', `Belum ada banner di ${where}`);
    else setCard('sys-storage', 'ok', null, `${where} · merespons ${storage.ms} ms`);

    // Keamanan
    renderChecks('sys-security', [
      g && g.protected === true
        ? { state: 'ok', title: 'Penulisan data tanpa login ditolak', detail: 'Hanya akun admin yang bisa menambah, mengubah, atau menghapus program. (Satu pesan "401" di console browser adalah hasil uji ini, bukan galat.)', meta: `${guard.ms} ms` }
        : { state: g && g.protected === false ? 'fail' : 'warn', title: 'Perlindungan penulisan data tidak terkonfirmasi', detail: g ? g.note : 'Uji tidak dapat dijalankan', meta: `${guard.ms} ms` },
      db.ok
        ? { state: 'ok', title: 'Pengunjung publik dapat membaca daftar program', detail: 'Diperlukan agar website tampil.', meta: `${db.ms} ms` }
        : { state: 'fail', title: 'Daftar program tidak dapat dibaca', detail: db.error.message },
      user
        ? { state: 'ok', title: 'Sesi admin valid', detail: `Diverifikasi ke server Supabase sebagai ${user.role}.` }
        : { state: 'fail', title: 'Sesi admin tidak valid', detail: 'Login ulang untuk melanjutkan.' },
    ]);

    // Kesehatan data + kartu data
    if (programs) {
      const lastUpdate = programs
        .map(p => new Date(p.updated_at || p.created_at || 0))
        .filter(d => !isNaN(d) && d.getTime() > 0)
        .sort((a, b) => b - a)[0] || null;
      renderChecks('sys-health', buildHealth(programs));
      renderConfig(lastUpdate);
    } else {
      renderChecks('sys-health', [{ state: 'fail', title: 'Data program tidak dapat dimuat', detail: 'Periksa koneksi database di atas.' }]);
      renderConfig(null);
    }

    $('sys-checked').textContent = `Terakhir diperiksa ${new Date().toLocaleTimeString('id-ID')}.`;
    recheck.disabled = false;
    recheck.classList.remove('is-busy');
    running = false;
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Tanpa sesi, admin.js akan mengarahkan ke halaman login
    if (!S || !S.getSession()) return;

    renderConfig(null);
    $('btn-recheck').addEventListener('click', runChecks);
    $('btn-check-images').addEventListener('click', () => checkImages(latestPrograms));
    runChecks();
  });
})();
