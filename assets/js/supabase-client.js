// ============================================================
// RUAI TV — Supabase Client Adapter (Vanilla JS REST, Auth & Storage)
// Berjalan langsung di browser tanpa node_modules / bundler
//
// Baca data program: publik (anon key).
// Tulis data / upload banner: wajib sesi Supabase Auth dengan
// app_metadata.role = 'admin'. Penegakan sebenarnya ada di RLS
// (database/supabase_security.sql), bukan di JS ini.
// ============================================================

window.escapeHtml = function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

window.RuaiSupabase = {
  SESSION_KEY: 'ruai_admin_session',

  getConfig() {
    const config = window.RUAI_SUPABASE_CONFIG || {};
    let url = (config.url || '').trim();
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const key = (config.anonKey || '').trim();
    const bucket = config.storageBucket || 'banners';
    return { url, key, bucket, isConfigured: Boolean(url && key) };
  },

  // Header untuk request publik (baca)
  getHeaders() {
    const { key } = this.getConfig();
    return {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    };
  },

  // Header untuk request admin (tulis): apikey anon + JWT milik user
  async getAuthHeaders() {
    const { key } = this.getConfig();
    const token = await this.getAccessToken();
    if (!token) throw this._authError('Sesi login berakhir. Silakan login kembali.');
    return {
      'apikey': key,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  },

  _authError(message) {
    const err = new Error(message);
    err.code = 'AUTH_REQUIRED';
    return err;
  },

  async _httpError(res, label) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message || body.msg || body.error_description || body.error || '';
    } catch (e) {}
    if (res.status === 401 || res.status === 403) {
      const err = this._authError(`${label}: akses ditolak (${res.status}). ${detail}`.trim());
      err.status = res.status;
      return err;
    }
    const err = new Error(`${label} (${res.status}) ${detail}`.trim());
    err.status = res.status;
    return err;
  },

  // ─── Auth: sesi ───
  _readSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY) || sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.access_token && s.refresh_token ? s : null;
    } catch (e) {
      return null;
    }
  },

  _writeSession(session, remember) {
    const useLocal = remember !== undefined ? remember : Boolean(localStorage.getItem(this.SESSION_KEY));
    try {
      localStorage.removeItem(this.SESSION_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
      (useLocal ? localStorage : sessionStorage).setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Gagal menyimpan sesi:', e);
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      sessionStorage.removeItem(this.SESSION_KEY);
    } catch (e) {}
  },

  getSession() {
    return this._readSession();
  },

  _toSession(payload) {
    const u = payload.user || {};
    const meta = u.user_metadata || {};
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at || (Math.floor(Date.now() / 1000) + (payload.expires_in || 3600)),
      user: {
        id: u.id,
        email: u.email,
        fullname: meta.full_name || meta.name || u.email,
        role: (u.app_metadata && u.app_metadata.role) || null
      }
    };
  },

  // ─── Auth: login / refresh / logout ───
  async signIn(email, password, remember = true) {
    const { url, key, isConfigured } = this.getConfig();
    if (!isConfigured) throw new Error('Konfigurasi Supabase belum diatur.');

    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      if (res.status === 400 || res.status === 401) {
        throw new Error('Email atau password salah.');
      }
      if (res.status === 429) {
        throw new Error('Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.');
      }
      throw await this._httpError(res, 'Login gagal');
    }

    const session = this._toSession(await res.json());
    if (session.user.role !== 'admin') {
      // Akun valid tapi bukan admin: jangan simpan sesi, cabut token yang baru terbit.
      await fetch(`${url}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${session.access_token}` }
      }).catch(() => {});
      throw new Error('Akun ini tidak memiliki akses admin.');
    }

    this._writeSession(session, remember);
    return session;
  },

  _refreshing: null,

  async _refresh(session) {
    if (this._refreshing) return this._refreshing;
    const { url, key } = this.getConfig();

    this._refreshing = (async () => {
      try {
        const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'apikey': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) {
          this.clearSession();
          return null;
        }
        const next = this._toSession(await res.json());
        this._writeSession(next);
        return next;
      } catch (e) {
        // Gangguan jaringan: pertahankan sesi lama, biarkan pemanggil gagal sendiri.
        return null;
      } finally {
        this._refreshing = null;
      }
    })();

    return this._refreshing;
  },

  // Token valid (otomatis diperbarui jika hampir kedaluwarsa); null jika tidak login.
  async getAccessToken() {
    const session = this._readSession();
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at - now > 60) return session.access_token;
    const next = await this._refresh(session);
    return next ? next.access_token : null;
  },

  // Verifikasi sesi ke server dan pastikan role admin. Mengembalikan user atau null.
  async verifySession() {
    const { url, key, isConfigured } = this.getConfig();
    if (!isConfigured) return null;
    let token;
    try {
      token = await this.getAccessToken();
    } catch (e) {
      return null;
    }
    if (!token) return null;

    try {
      const res = await fetch(`${url}/auth/v1/user`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) this.clearSession();
        return null;
      }
      const u = await res.json();
      if (!u.app_metadata || u.app_metadata.role !== 'admin') {
        this.clearSession();
        return null;
      }
      const session = this._readSession();
      return session ? session.user : null;
    } catch (e) {
      return null;
    }
  },

  async signOut() {
    const { url, key } = this.getConfig();
    const session = this._readSession();
    this.clearSession();
    if (session) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': key, 'Authorization': `Bearer ${session.access_token}` }
        });
      } catch (e) {}
    }
  },

  // ─── GET Programs (publik) ───
  async getPrograms() {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) return null;

    try {
      const res = await fetch(`${url}/rest/v1/programs?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error(`Supabase error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (err) {
      console.warn('Supabase fetch programs failed:', err);
      return null;
    }
  },

  // ─── INSERT / UPDATE Program (admin) ───
  async upsertProgram(programData) {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) throw new Error('Konfigurasi Supabase belum diatur.');

    const res = await fetch(`${url}/rest/v1/programs?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...(await this.getAuthHeaders()),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(programData)
    });
    if (!res.ok) throw await this._httpError(res, 'Simpan program gagal');
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Simpan program gagal: tidak ada baris yang tersimpan (cek policy RLS).');
    }
    return rows[0];
  },

  // ─── PATCH sebagian kolom Program (admin) ───
  async updateProgram(programId, fields) {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) throw new Error('Konfigurasi Supabase belum diatur.');

    const res = await fetch(`${url}/rest/v1/programs?id=eq.${encodeURIComponent(programId)}`, {
      method: 'PATCH',
      headers: { ...(await this.getAuthHeaders()), 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw await this._httpError(res, 'Ubah program gagal');
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Ubah program gagal: program tidak ditemukan atau akses ditolak.');
    }
    return rows[0];
  },

  // ─── DELETE Program (admin) ───
  async deleteProgram(programId) {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) throw new Error('Konfigurasi Supabase belum diatur.');

    const res = await fetch(`${url}/rest/v1/programs?id=eq.${encodeURIComponent(programId)}`, {
      method: 'DELETE',
      headers: { ...(await this.getAuthHeaders()), 'Prefer': 'return=representation' }
    });
    if (!res.ok) throw await this._httpError(res, 'Hapus program gagal');
    // RLS menyaring baris secara diam-diam, jadi 0 baris = tidak ada yang terhapus.
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Hapus program gagal: program tidak ditemukan atau akses ditolak.');
    }
    return true;
  },

  // ─── UPLOAD Banner to Storage Bucket (admin) ───
  async uploadBanner(blobOrFile, filename) {
    const { url, key, bucket, isConfigured } = this.getConfig();
    if (!isConfigured) throw new Error('Konfigurasi Supabase belum diatur.');

    const token = await this.getAccessToken();
    if (!token) throw this._authError('Sesi login berakhir. Silakan login kembali.');

    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFilename = `${Date.now()}-${cleanName}`;

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${uniqueFilename}`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`,
        'Content-Type': blobOrFile.type || 'image/webp'
      },
      body: blobOrFile
    });
    if (!res.ok) throw await this._httpError(res, 'Upload banner gagal');

    return `${url}/storage/v1/object/public/${bucket}/${uniqueFilename}`;
  }
};
