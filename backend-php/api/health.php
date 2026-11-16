<?php
/**
 * RUAI TV API — /api/health.php  (khusus admin, baca-saja)
 * Dipakai halaman "Sistem Backend". Tidak pernah mengembalikan password/kunci.
 */
declare(strict_types=1);

require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/storage.php';

require_method(['GET']);
$admin = require_admin();

// Database
$t0 = microtime(true);
try {
    $pdo = db();
    $version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
    $count = (int) $pdo->query('SELECT COUNT(*) FROM programs')->fetchColumn();
    $database = ['ok' => true, 'ms' => (int) round((microtime(true) - $t0) * 1000), 'server' => $version, 'programs' => $count];
} catch (Throwable $e) {
    error_log('[ruai-api] health db: ' . $e->getMessage());
    $database = ['ok' => false, 'ms' => (int) round((microtime(true) - $t0) * 1000), 'server' => null, 'programs' => null];
}

// Storage
try {
    $storage = storage();
    $storageStatus = $storage->check() + $storage->info();
} catch (Throwable $e) {
    $storageStatus = ['ok' => false, 'ms' => 0, 'detail' => $e->getMessage(), 'driver' => ruai_config()['storage']['driver']];
}

json_out([
    'time' => gmdate('Y-m-d\TH:i:s\Z'),
    'php' => PHP_VERSION,
    'database' => $database,
    'storage' => $storageStatus,
    'session' => ['expires_at' => $admin['expires_at']],
]);
