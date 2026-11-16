// ============================================================
// RUAI TV — Vercel Function: /api/banner
//
//   POST  unggah banner ke bucket Object Storage IDCloudHost
//         Header: Authorization: Bearer <token login Supabase admin>
//                 Content-Type: application/octet-stream
//                 X-Filename: awalan nama file (opsional)
//         Body  : isi gambar mentah (WebP / JPEG / PNG, maks. 1 MB)
//         → 201 {url, key, size, mime}
//
//   GET   status bucket (baca-saja, khusus admin) untuk halaman Sistem Backend
//         → 200 {ok, detail, bucket, endpoint_host, public_base_url, ms}
//
// Kunci bucket hanya dibaca dari Environment Variables Vercel; tidak pernah dikirim
// ke browser. Siapa yang boleh mengunggah ditentukan dengan menanyakan token ke
// Supabase (role admin), jadi akses tetap satu pintu dengan login yang sudah ada.
//
// Tanpa dependensi npm: hanya modul bawaan Node.js 18+ (crypto, fetch).
// ============================================================

'use strict';

const crypto = require('node:crypto');

const MAX_BYTES = 1024 * 1024; // 1 MB (admin panel sudah mengompres ke ≤ 100 KB)

// Nilai publik (sama dengan assets/js/supabase-config.js). Boleh ditimpa lewat env.
const DEFAULT_SUPABASE_URL = 'https://ivofwlzwxzjwvuuehier.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_bAr_VCx8tnPXbZvKw07vxQ_70oxh_G1';

// Tipe diputuskan dari isi file (magic bytes), bukan dari header/ekstensi kiriman klien.
const IMAGE_TYPES = [
  { mime: 'image/webp', ext: 'webp', test: (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ─── Konfigurasi dari Environment Variables ───
function loadConfig() {
  const e = process.env;
  const need = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_PUBLIC_BASE_URL'];
  const missing = need.filter((k) => !String(e[k] || '').trim());
  if (missing.length) {
    console.error('[banner] Environment Variable belum diisi:', missing.join(', '));
    throw new HttpError(500, 'Penyimpanan banner belum dikonfigurasi di server (Environment Variables Vercel).');
  }

  let endpoint;
  try {
    endpoint = new URL(String(e.S3_ENDPOINT).trim().replace(/\/+$/, ''));
    if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('protokol');
  } catch (err) {
    console.error('[banner] S3_ENDPOINT tidak valid');
    throw new HttpError(500, 'S3_ENDPOINT tidak valid.');
  }

  return {
    endpoint,
    bucket: String(e.S3_BUCKET).trim(),
    accessKey: String(e.S3_ACCESS_KEY).trim(),
    secretKey: String(e.S3_SECRET_KEY).trim(),
    region: String(e.S3_REGION || 'us-east-1').trim(),
    pathStyle: String(e.S3_PATH_STYLE || 'true').toLowerCase() !== 'false',
    acl: String(e.S3_ACL || '').trim(), // kosong = jangan kirim header ACL (akses publik lewat bucket policy)
    publicBase: String(e.S3_PUBLIC_BASE_URL).trim().replace(/\/+$/, ''),
    supabaseUrl: String(e.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, ''),
    supabaseKey: String(e.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim(),
  };
}

// ─── Autentikasi: token Supabase milik admin ───
function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(header);
  return m ? m[1] : null;
}

async function requireAdmin(req, cfg) {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Sesi login berakhir. Silakan login kembali.');

  let res;
  try {
    res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: cfg.supabaseKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error('[banner] Supabase tidak terjangkau:', err.message);
    throw new HttpError(502, 'Tidak dapat memverifikasi login ke server autentikasi.');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Sesi login tidak valid. Silakan login kembali.');
  if (!res.ok) throw new HttpError(502, 'Server autentikasi merespons galat.');

  const user = await res.json();
  if (!user.app_metadata || user.app_metadata.role !== 'admin') {
    throw new HttpError(403, 'Akun ini tidak memiliki akses admin.');
  }
  return user;
}

// ─── AWS Signature V4 (layanan s3) ───
const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const encodeSegment = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Fungsi murni; diuji dengan contoh resmi dokumentasi AWS. */
function signV4({ method, canonicalUri, canonicalQuery = '', headers, payloadHash, amzDate, region, accessKey, secretKey }) {
  const norm = {};
  for (const [k, v] of Object.entries(headers)) norm[k.toLowerCase()] = String(v).replace(/\s+/g, ' ').trim();
  const names = Object.keys(norm).sort();
  const canonicalHeaders = names.map((n) => `${n}:${norm[n]}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kSigning = hmac(hmac(hmac(hmac('AWS4' + secretKey, date), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return {
    signature,
    signedHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function s3Target(cfg, key) {
  const port = cfg.endpoint.port ? `:${cfg.endpoint.port}` : '';
  const host = (cfg.pathStyle ? '' : `${cfg.bucket}.`) + cfg.endpoint.hostname + port;
  let uri = cfg.pathStyle ? `/${encodeSegment(cfg.bucket)}` : '';
  if (key) uri += '/' + key.split('/').map(encodeSegment).join('/');
  if (!uri) uri = '/';
  return { host, uri, url: `${cfg.endpoint.protocol}//${host}${uri}` };
}

async function s3Request(cfg, method, key, body, extraHeaders = {}) {
  const payload = body || Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260101T000000Z
  const { host, uri, url } = s3Target(cfg, key);

  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  for (const [k, v] of Object.entries(extraHeaders)) headers[k.toLowerCase()] = v;

  const signed = signV4({
    method, canonicalUri: uri, headers, payloadHash, amzDate,
    region: cfg.region, accessKey: cfg.accessKey, secretKey: cfg.secretKey,
  });

  const send = { ...headers, authorization: signed.authorization };
  delete send.host; // diisi otomatis oleh fetch dengan nilai yang sama

  const res = await fetch(url, {
    method,
    headers: send,
    body: method === 'PUT' ? payload : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
  });
  const text = method === 'HEAD' ? '' : await res.text();
  return { status: res.status, text };
}

const publicUrl = (cfg, key) => `${cfg.publicBase}/${key.split('/').map(encodeSegment).join('/')}`;

// ─── Body mentah (maks. MAX_BYTES) ───
async function readBody(req) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BYTES) throw new HttpError(413, `Ukuran file maksimal ${Math.round(MAX_BYTES / 1024)} KB.`);

  if (Buffer.isBuffer(req.body)) return req.body; // sudah dibaca oleh runtime Vercel
  if (req.body !== undefined && req.body !== null && typeof req.body !== 'object') {
    throw new HttpError(415, 'Kirim isi gambar mentah dengan Content-Type: application/octet-stream.');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new HttpError(413, `Ukuran file maksimal ${Math.round(MAX_BYTES / 1024)} KB.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

// ─── Handler ───
async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST');
      throw new HttpError(405, `Metode ${req.method} tidak didukung.`);
    }

    const cfg = loadConfig();
    await requireAdmin(req, cfg);

    if (req.method === 'GET') {
      const t0 = Date.now();
      let r;
      try {
        r = await s3Request(cfg, 'HEAD', '');
      } catch (err) {
        return send(res, 200, { ok: false, ms: Date.now() - t0, detail: `Tidak dapat menghubungi storage: ${err.message}` });
      }
      const detail =
        r.status >= 200 && r.status < 300 ? 'Bucket dapat diakses dengan kunci yang dikonfigurasi.'
          : r.status === 403 ? 'Akses ditolak (403): periksa S3_ACCESS_KEY / S3_SECRET_KEY.'
            : r.status === 404 ? 'Bucket tidak ditemukan (404): periksa S3_BUCKET dan S3_ENDPOINT.'
              : `Respons tak terduga dari storage (HTTP ${r.status}).`;
      return send(res, 200, {
        ok: r.status >= 200 && r.status < 300,
        ms: Date.now() - t0,
        detail,
        bucket: cfg.bucket,
        endpoint_host: cfg.endpoint.hostname,
        public_base_url: cfg.publicBase,
      });
    }

    // POST: unggah banner
    const body = await readBody(req);
    if (body.length === 0) throw new HttpError(400, 'File gambar kosong.');
    if (body.length > MAX_BYTES) throw new HttpError(413, `Ukuran file maksimal ${Math.round(MAX_BYTES / 1024)} KB.`);
    const type = IMAGE_TYPES.find((t) => t.test(body));
    if (!type) throw new HttpError(415, 'Format gambar harus WebP, JPEG, atau PNG.');

    const rawName = String(req.headers['x-filename'] || '').toLowerCase().replace(/\.[a-z0-9]{1,5}$/, '');
    const prefix = rawName.replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '');
    const key = `banners/${prefix ? prefix + '-' : ''}${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${type.ext}`;

    const extra = { 'content-type': type.mime, 'cache-control': 'public, max-age=31536000, immutable' };
    if (cfg.acl) extra['x-amz-acl'] = cfg.acl;

    let r;
    try {
      r = await s3Request(cfg, 'PUT', key, body, extra);
    } catch (err) {
      console.error('[banner] upload gagal:', err.message);
      throw new HttpError(502, 'Tidak dapat menghubungi penyimpanan banner. Coba lagi atau cek menu Sistem Backend.');
    }
    if (r.status < 200 || r.status >= 300) {
      const code = (/<Code>([^<]+)<\/Code>/.exec(r.text) || [])[1] || '';
      console.error(`[banner] storage menolak upload: HTTP ${r.status} ${code}`);
      throw new HttpError(502, `Penyimpanan banner menolak unggahan (HTTP ${r.status}${code ? ', ' + code : ''}). Cek menu Sistem Backend.`);
    }

    return send(res, 201, { url: publicUrl(cfg, key), key, size: body.length, mime: type.mime });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error('[banner] galat tak terduga:', err);
    return send(res, 500, { error: 'Terjadi kesalahan pada server.' });
  }
}

module.exports = handler;
module.exports.signV4 = signV4; // untuk pengujian
