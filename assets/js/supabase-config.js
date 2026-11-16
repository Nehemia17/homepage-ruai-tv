// ============================================================
// RUAI TV — Supabase Credentials & Configuration
// Connected to Supabase Project: ruai-tv
// ============================================================

window.RUAI_SUPABASE_CONFIG = {
  // URL Project Supabase Ruai TV
  url: "https://ivofwlzwxzjwvuuehier.supabase.co",
  
  // Anon Public Key Supabase
  anonKey: "sb_publishable_bAr_VCx8tnPXbZvKw07vxQ_70oxh_G1",
  
  // Nama bucket Supabase Storage (dipakai bila bannerStorage = "supabase",
  // dan untuk banner lama yang masih tersimpan di sana)
  storageBucket: "banners",

  // Tujuan upload banner baru:
  //   "bucket"   = bucket Object Storage IDCloudHost, lewat Vercel Function /api/banner
  //                (kunci bucket ada di Environment Variables Vercel, bukan di sini)
  //   "supabase" = Supabase Storage (cara lama, tanpa Vercel Function)
  bannerStorage: "bucket",
  bannerApi: "/api/banner"
};
