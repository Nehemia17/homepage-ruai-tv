// ============================================================
// RUAI TV — API Client (vanilla JS, tanpa bundler)
//
// Bicara dengan backend PHP di /api (lihat api/*.php):
//   - baca program: publik
//   - tulis program / upload banner: wajib login admin
//
// Login memakai cookie sesi HttpOnly yang diatur server, jadi JavaScript tidak
// pernah memegang token login. Yang disimpan di browser hanya "petunjuk" UI
// (nama & email admin) yang BUKAN kredensial. Penegakan hak akses sebenarnya
// ada di server (require_admin di api/lib/auth.php), bukan di JS ini.
// ============================================================

window.escapeHtml = function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.RuaiAPI = {
  SESSION_KEY: 'ruai_admin_session',

  // Token CSRF milik sesi login saat ini (hanya di memori halaman).
  _csrf: null,
  _verifying: null,

  getConfig() {
    const config = window.RUAI_API_CONFIG || {};
    const baseUrl = String(config.baseUrl || '/api').trim().replace(/\/+$/, '');
    return { baseUrl, isConfigured: baseUrl.length > 0 };
  },

  _url(endpoint, params) {
    const { baseUrl } = this.getConfig();
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return `${baseUrl}/${endpoint}${query}`;
  },

  _authError(message) {
    const err = new Error(message);
    err.code = 'AUTH_REQUIRED';
    return err;
  },

  // Galat dari respons non-2xx. Pesan server sudah berbahasa Indonesia.
  async _httpError(res, label) {
    let data = {};
    try { data = await res.json(); } catch (e) {}
    const detail = data.error || '';
    const authCodes = ['AUTH_REQUIRED', 'FORBIDDEN', 'CSRF'];
    if (authCodes.includes(data.code) || (!data.code && (res.status === 401 || res.status === 403))) {
      const err = this._authError(`${label}: akses ditolak (${res.status}). ${detail}`.trim());
      err.status = res.status;
      return err;
    }
    const err = new Error(detail ? `${label}: ${detail}` : `${label} (HTTP ${res.status})`);
    err.status = res.status;
    err.code = data.code || '';
    return err;
  },

  async _fetch(endpoint, { method = 'GET', params, json, body, csrf = false, timeout = 20000, label = 'Permintaan', credentials = 'include' } = {}) {
    const headers = {};
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = await this._getCsrf();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(this._url(endpoint, params), {
        method,
        headers,
        credentials,
        body: json !== undefined ? JSON.stringify(json) : body,
        signal: controller.signal
      });
    } catch (e) {
      const err = new Error(e && e.name === 'AbortError'
        ? `${label}: server tidak merespons (waktu habis).`
        : `${label}: tidak dapat menghubungi server.`);
      err.code = 'NETWORK';
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },

  // ─── Sesi: petunjuk UI di browser (bukan kredensial) ───
  _readSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.user || !s.user.email) return null;
      if (s.expires_at && s.expires_at <= Math.floor(Date.now() / 1000)) return null;
      return s;
    } catch (e) {
      return null;
    }
  },

  _writeSession(session, remember) {
    const useLocal = remember !== undefined ? remember : Boolean(localStorage.getItem(this.SESSION_KEY));
    try {
      localStorage.removeItem(this.SESSION_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
      (useLocal ? localStorage : sessionStorage).setItem(this.SESSION_KEY, JSON.stringify({
        user: session.user,
        expires_at: session.expires_at
      }));
    } catch (e) {
      console.warn('Gagal menyimpan petunjuk sesi:', e);
    }
  },

  clearSession() {
    this._csrf = null;
    try {
      localStorage.removeItem(this.SESSION_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
    } catch (e) {}
  },

  getSession() {
    return this._readSession();
  },

  // ─── Auth ───
  async signIn(email, password, remember = true) {
    if (!this.getConfig().isConfigured) throw new Error('Alamat API belum diatur.');

    const res = await this._fetch('auth.php', {
      method: 'POST',
      params: { action: 'login' },
      json: { email, password, remember: Boolean(remember) },
      label: 'Login gagal'
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Email atau password salah.');
      if (res.status === 429) throw new Error('Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.');
      if (res.status === 403) {
        let data = {};
        try { data = await res.clone().json(); } catch (e) {}
        if (data.code === 'FORBIDDEN') throw new Error('Akun ini tidak memiliki akses admin.');
      }
      throw await this._httpError(res, 'Login gagal');
    }

    const data = await res.json();
    this._csrf = data.csrf_token;
    this._writeSession(data, remember);
    return { user: data.user, expires_at: data.expires_at };
  },

  async _me() {
    const res = await this._fetch('auth.php', { params: { action: 'me' }, label: 'Verifikasi sesi' });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
        throw this._authError('Sesi login berakhir. Silakan login kembali.');
      }
      throw await this._httpError(res, 'Verifikasi sesi');
    }
    const data = await res.json();
    this._csrf = data.csrf_token;
    this._writeSession(data);
    return data;
  },

  async _getCsrf() {
    if (this._csrf) return this._csrf;
    const me = await this._me();
    return me.csrf_token;
  },

  // Tanya server apakah sesi (cookie) masih sah dan role-nya admin. Mengembalikan user atau null.
  verifySession() {
    if (!this._verifying) {
      this._verifying = this._me()
        .then((me) => me.user)
        .catch(() => null)
        .finally(() => { this._verifying = null; });
    }
    return this._verifying;
  },

  async signOut() {
    try {
      await this._fetch('auth.php', { method: 'POST', params: { action: 'logout' }, json: {}, label: 'Logout', timeout: 8000 });
    } catch (e) {}
    this.clearSession();
  },

  // ─── GET Programs (publik) ───
  async getPrograms() {
    if (!this.getConfig().isConfigured) return null;
    try {
      const res = await this._fetch('programs.php', { label: 'Muat program', timeout: 8000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (err) {
      console.warn('Gagal memuat program dari API:', err);
      return null;
    }
  },

  // ─── INSERT / UPDATE Program (admin) ───
  async upsertProgram(programData) {
    const res = await this._fetch('programs.php', { method: 'POST', json: programData, csrf: true, label: 'Simpan program gagal' });
    if (!res.ok) throw await this._httpError(res, 'Simpan program gagal');
    return res.json();
  },

  // ─── PATCH sebagian kolom Program (admin) ───
  async updateProgram(programId, fields) {
    const res = await this._fetch('programs.php', { method: 'PATCH', params: { id: programId }, json: fields, csrf: true, label: 'Ubah program gagal' });
    if (!res.ok) throw await this._httpError(res, 'Ubah program gagal');
    return res.json();
  },

  // ─── DELETE Program (admin) ───
  async deleteProgram(programId) {
    const res = await this._fetch('programs.php', { method: 'DELETE', params: { id: programId }, csrf: true, label: 'Hapus program gagal' });
    if (!res.ok) throw await this._httpError(res, 'Hapus program gagal');
    return true;
  },

  // ─── UPLOAD Banner (admin): server memvalidasi lalu menyimpannya ke storage ───
  async uploadBanner(blobOrFile, filename) {
    const form = new FormData();
    form.append('file', blobOrFile, filename);
    form.append('name', filename);
    const res = await this._fetch('upload.php', { method: 'POST', body: form, csrf: true, timeout: 60000, label: 'Upload banner gagal' });
    if (!res.ok) throw await this._httpError(res, 'Upload banner gagal');
    const data = await res.json();
    return data.url;
  },

  // ─── Status backend (admin, baca-saja): dipakai halaman Sistem Backend ───
  async health() {
    const res = await this._fetch('health.php', { label: 'Status sistem', timeout: 30000 });
    if (!res.ok) throw await this._httpError(res, 'Status sistem');
    return res.json();
  },

  // Uji proteksi tulis: kirim permintaan TANPA kredensial. Server harus menjawab 401/403
  // sebelum membaca isinya, sehingga tidak ada data yang tertulis.
  async probeWriteGuard() {
    const res = await this._fetch('programs.php', {
      method: 'POST',
      json: { id: '__sys_probe__' },
      credentials: 'omit',
      label: 'Uji proteksi',
      timeout: 10000
    });
    if (res.status === 401 || res.status === 403) return { protected: true, status: res.status };
    return { protected: false, status: res.status, note: `Penulisan tanpa login tidak ditolak (HTTP ${res.status})` };
  }
};
