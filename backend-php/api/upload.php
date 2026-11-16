<?php
/**
 * RUAI TV API — /api/upload.php  (khusus admin)
 *   POST multipart/form-data: file = gambar banner (WebP/JPEG/PNG, maks storage.max_upload_bytes)
 *                             name = awalan nama file (opsional)
 *   → 201 {url, key, size, mime}
 */
declare(strict_types=1);

require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/storage.php';

require_method(['POST']);
require_admin();

const UPLOAD_TYPES = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
const UPLOAD_MAX_DIMENSION = 4096;

$file = $_FILES['file'] ?? null;
if (!is_array($file) || is_array($file['error'] ?? null)) {
    api_fail(400, 'File gambar belum dikirim (field "file").');
}
switch ($file['error']) {
    case UPLOAD_ERR_OK:
        break;
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:
        api_fail(413, 'Ukuran file melebihi batas server.');
    case UPLOAD_ERR_NO_FILE:
        api_fail(400, 'File gambar belum dikirim.');
    default:
        api_fail(500, 'Upload gagal diproses server.');
}

$maxBytes = (int) ruai_config()['storage']['max_upload_bytes'];
if ($file['size'] <= 0 || $file['size'] > $maxBytes) {
    api_fail(413, 'Ukuran file maksimal ' . round($maxBytes / 1024) . ' KB.');
}
if (!is_uploaded_file($file['tmp_name'])) {
    api_fail(400, 'File upload tidak valid.');
}

// Jangan percaya Content-Type/ekstensi dari klien: tentukan dari isi file.
$mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
if (!is_string($mime) || !isset(UPLOAD_TYPES[$mime])) {
    api_fail(415, 'Format gambar harus WebP, JPEG, atau PNG.');
}
$info = @getimagesize($file['tmp_name']);
if ($info === false || $info[0] < 1 || $info[1] < 1 || $info[0] > UPLOAD_MAX_DIMENSION || $info[1] > UPLOAD_MAX_DIMENSION) {
    api_fail(422, 'File bukan gambar yang valid atau dimensinya melebihi ' . UPLOAD_MAX_DIMENSION . ' px.');
}

$bytes = file_get_contents($file['tmp_name']);
if ($bytes === false) {
    api_fail(500, 'File upload tidak dapat dibaca.');
}

$prefix = is_string($_POST['name'] ?? null) ? $_POST['name'] : '';
$prefix = strtolower(preg_replace('/\.[A-Za-z0-9]{1,5}$/', '', $prefix));      // buang ekstensi
$prefix = trim(substr(preg_replace('/[^a-z0-9]+/', '-', $prefix), 0, 40), '-');
$key = 'banners/' . ($prefix !== '' ? $prefix . '-' : '') . time() . '-' . bin2hex(random_bytes(4)) . '.' . UPLOAD_TYPES[$mime];

try {
    $url = storage()->put($key, $bytes, $mime);
} catch (Throwable $e) {
    error_log('[ruai-api] upload: ' . $e->getMessage());
    api_fail(502, 'Gagal menyimpan gambar ke penyimpanan. Cek menu Sistem Backend atau hubungi Administrator IT.', 'STORAGE');
}
json_out(['url' => $url, 'key' => $key, 'size' => strlen($bytes), 'mime' => $mime], 201);
