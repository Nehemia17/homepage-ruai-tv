// ============================================================
// RUAI TV — Supabase Credentials & Configuration
// Isi nilai SUPABASE_URL dan SUPABASE_ANON_KEY dari dashboard Supabase:
// Project Settings -> API -> Project URL & Project API Keys (anon public)
// ============================================================

window.RUAI_SUPABASE_CONFIG = {
  // Ganti dengan URL Project Supabase Anda, contoh: "https://xyzcompany.supabase.co"
  url: window.localStorage.getItem('RUAI_SUPABASE_URL') || "",
  
  // Ganti dengan Anon Public Key Supabase Anda
  anonKey: window.localStorage.getItem('RUAI_SUPABASE_ANON_KEY') || "",
  
  // Nama bucket Supabase Storage untuk upload gambar thumbnail banner
  storageBucket: "banners"
};
