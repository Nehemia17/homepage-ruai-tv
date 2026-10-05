<?php
// ============================================================
// RUAI TV — Image Upload API (api/upload.php)
// Saves banner images directly to assets/images/programs/
// Supports WebP conversion and enforces <= 100KB target size
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Metode request harus POST."]);
    exit();
}

if (!isset($_FILES['banner_file']) || $_FILES['banner_file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "File gambar tidak ditemukan atau terjadi kesalahan saat mengunggah."]);
    exit();
}

$file = $_FILES['banner_file'];
$uploadDir = __DIR__ . '/../assets/images/programs/';

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['png', 'jpg', 'jpeg', 'webp'];

if (!in_array($ext, $allowed)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Format file tidak didukung. Hanya diperbolehkan: PNG, JPG, JPEG, WEBP."]);
    exit();
}

// Clean filename
$rawName = pathinfo($file['name'], PATHINFO_FILENAME);
$cleanName = preg_replace('/[^A-Za-z0-9-]+/', '-', $rawName);
$cleanName = trim($cleanName, '-');
if (empty($cleanName)) {
    $cleanName = 'program-banner';
}

// File size limit: 500KB safety ceiling on raw upload (client ensures <= 100KB for WebP)
if ($file['size'] > 500 * 1024) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Ukuran file terlalu besar. Maksimal 100KB per foto banner."]);
    exit();
}

// If already WebP from client
if ($ext === 'webp') {
    $fileName = $cleanName . '-' . time() . '.webp';
    $targetPath = $uploadDir . $fileName;
    $relativePath = 'assets/images/programs/' . $fileName;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        echo json_encode([
            "status" => "success",
            "message" => "File banner WebP berhasil diunggah.",
            "url" => $relativePath,
            "size" => filesize($targetPath)
        ]);
        exit();
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Gagal menyimpan file WebP di server."]);
        exit();
    }
}

// If uploaded as PNG/JPG/JPEG, auto-convert to WebP if PHP GD extension is available
if (function_exists('imagewebp') && in_array($ext, ['png', 'jpg', 'jpeg'])) {
    $srcImg = null;
    if ($ext === 'png') {
        $srcImg = @imagecreatefrompng($file['tmp_name']);
    } elseif ($ext === 'jpg' || $ext === 'jpeg') {
        $srcImg = @imagecreatefromjpeg($file['tmp_name']);
    }

    if ($srcImg) {
        $fileName = $cleanName . '-' . time() . '.webp';
        $targetPath = $uploadDir . $fileName;
        $relativePath = 'assets/images/programs/' . $fileName;

        imagewebp($srcImg, $targetPath, 85);
        imagedestroy($srcImg);

        echo json_encode([
            "status" => "success",
            "message" => "File banner berhasil dikonversi ke WebP dan disimpan.",
            "url" => $relativePath,
            "size" => filesize($targetPath)
        ]);
        exit();
    }
}

// Fallback: save original format if GD conversion not possible
$fileName = $cleanName . '-' . time() . '.' . $ext;
$targetPath = $uploadDir . $fileName;
$relativePath = 'assets/images/programs/' . $fileName;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    echo json_encode([
        "status" => "success",
        "message" => "File banner berhasil diunggah.",
        "url" => $relativePath,
        "size" => filesize($targetPath)
    ]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Gagal menyimpan file di server."]);
}

