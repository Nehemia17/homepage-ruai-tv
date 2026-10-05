// ============================================================
// RUAI TV — Supabase Client Adapter (Vanilla JS REST & Storage)
// Berjalan langsung di browser tanpa node_modules / bundler
// ============================================================

window.RuaiSupabase = {
  getConfig() {
    const config = window.RUAI_SUPABASE_CONFIG || {};
    let url = (config.url || localStorage.getItem('RUAI_SUPABASE_URL') || '').trim();
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const key = (config.anonKey || localStorage.getItem('RUAI_SUPABASE_ANON_KEY') || '').trim();
    const bucket = config.storageBucket || 'banners';
    return { url, key, bucket, isConfigured: Boolean(url && key) };
  },

  getHeaders() {
    const { key } = this.getConfig();
    return {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    };
  },

  // ─── GET Programs ───
  async getPrograms() {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) return null;

    try {
      const res = await fetch(`${url}/rest/v1/programs?select=*&order=created_at.desc`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error(`Supabase error: ${res.statusText}`);
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (err) {
      console.warn('Supabase fetch programs failed:', err);
      return null;
    }
  },

  // ─── INSERT / UPDATE Program ───
  async upsertProgram(programData) {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) return null;

    try {
      const res = await fetch(`${url}/rest/v1/programs`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(programData)
      });
      if (!res.ok) throw new Error(`Supabase upsert error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error('Supabase upsert program failed:', err);
      throw err;
    }
  },

  // ─── DELETE Program ───
  async deleteProgram(programId) {
    const { url, isConfigured } = this.getConfig();
    if (!isConfigured) return false;

    try {
      const res = await fetch(`${url}/rest/v1/programs?id=eq.${encodeURIComponent(programId)}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return res.ok;
    } catch (err) {
      console.error('Supabase delete program failed:', err);
      return false;
    }
  },

  // ─── UPLOAD Banner to Storage Bucket ───
  async uploadBanner(blobOrFile, filename) {
    const { url, bucket, key, isConfigured } = this.getConfig();
    if (!isConfigured) return null;

    try {
      const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFilename = `${Date.now()}-${cleanName}`;
      const uploadUrl = `${url}/storage/v1/object/${bucket}/${uniqueFilename}`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'image/webp',
          'x-upsert': 'true'
        },
        body: blobOrFile
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Upload storage error (${res.status}): ${errorText}`);
      }

      // Public URL format Supabase Storage
      const publicUrl = `${url}/storage/v1/object/public/${bucket}/${uniqueFilename}`;
      return publicUrl;
    } catch (err) {
      console.error('Supabase uploadBanner failed:', err);
      throw err;
    }
  }
};
