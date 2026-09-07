<?php
// ============================================================
// RUAI TV — Database Connection Helper (api/db.php)
// Environment: Localhost XAMPP / Apache / MySQL
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db_host = 'localhost';
$db_name = 'ruai_tv';
$db_user = 'root';
$db_pass = '';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // Return structured error JSON if MySQL connection fails
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Koneksi Database MySQL Gagal: " . $e->getMessage(),
        "hint" => "Pastikan MySQL di XAMPP sudah berjalan dan database 'ruai_tv' sudah diimpor dari file database/ruai_tv.sql"
    ]);
    exit();
}
