<?php
/**
 * RUAI TV API — inti: konfigurasi, koneksi database, penanganan galat.
 * Dipakai oleh endpoint web (lewat http.php) maupun alat CLI.
 * Kompatibel PHP 8.0+.
 */
declare(strict_types=1);

if (PHP_VERSION_ID < 80000) {
    if (PHP_SAPI !== 'cli') {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo '{"error":"Server membutuhkan PHP 8.0 atau lebih baru."}';
    exit(1);
}

define('RUAI_API_DIR', dirname(__DIR__));
define('RUAI_SITE_DIR', dirname(RUAI_API_DIR));

ini_set('display_errors', '0');
ini_set('log_errors', '1');

/** Galat yang aman ditampilkan ke klien (pesan sudah berbahasa Indonesia). */
final class ApiError extends RuntimeException
{
    public int $status;
    public string $errorCode;
    public array $extra;

    public function __construct(int $status, string $message, string $errorCode = '', array $extra = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->extra = $extra;
    }
}

function api_fail(int $status, string $message, string $code = '', array $extra = []): void
{
    throw new ApiError($status, $message, $code, $extra);
}

// ─── Konfigurasi ───
function ruai_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $defaults = [
        'debug' => false,
        'db' => ['host' => 'localhost', 'port' => 3306, 'name' => '', 'user' => '', 'pass' => ''],
        'storage' => [
            'driver' => 'local',
            'max_upload_bytes' => 1048576,
            's3' => [
                'endpoint' => '', 'region' => 'us-east-1', 'bucket' => '',
                'access_key' => '', 'secret_key' => '',
                'path_style' => true, 'public_base_url' => '', 'acl' => 'public-read',
            ],
            'local' => ['dir' => null, 'public_base_url' => '/uploads'],
        ],
        'session' => ['default_hours' => 12, 'remember_days' => 30, 'cookie_samesite' => 'Strict'],
        'cors_allowed_origins' => [],
        'trust_proxy_headers' => false,
    ];

    $candidates = array_filter([
        getenv('RUAI_CONFIG') ?: null,
        dirname(RUAI_SITE_DIR) . '/ruai-config.php',
        RUAI_API_DIR . '/config.php',
    ]);

    $loaded = null;
    foreach ($candidates as $file) {
        if (is_file($file)) {
            $loaded = require $file;
            break;
        }
    }
    if (!is_array($loaded)) {
        throw new RuntimeException('Konfigurasi tidak ditemukan. Salin api/config.example.php menjadi api/config.php lalu isi nilainya.');
    }

    $config = array_replace_recursive($defaults, $loaded);
    return $config;
}

// ─── Penanganan galat (JSON untuk web, teks untuk CLI) ───
function ruai_handle_exception(Throwable $e): void
{
    $isApi = $e instanceof ApiError;
    $status = $isApi ? $e->status : 500;
    $message = $isApi ? $e->getMessage() : 'Terjadi kesalahan pada server.';

    if (!$isApi) {
        error_log('[ruai-api] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    }

    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Galat: " . $e->getMessage() . PHP_EOL);
        exit(1);
    }

    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        if ($isApi && $status === 429 && isset($e->extra['retry_after'])) {
            header('Retry-After: ' . (int) $e->extra['retry_after']);
        }
    }

    $body = ['error' => $message];
    if ($isApi && $e->errorCode !== '') {
        $body['code'] = $e->errorCode;
    }
    if ($isApi && isset($e->extra['details'])) {
        $body['details'] = $e->extra['details'];
    }
    try {
        if (!$isApi && ruai_config()['debug']) {
            $body['detail'] = $e->getMessage();
        }
    } catch (Throwable $ignored) {
    }

    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
set_exception_handler('ruai_handle_exception');

// ─── Database ───
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $c = ruai_config()['db'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int) $c['port'], $c['name']);
    $pdo = new PDO($dsn, (string) $c['user'], (string) $c['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
    ]);
    // Semua DATETIME disimpan & dibaca sebagai UTC, apa pun zona waktu server.
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

// ─── Util kecil ───
function utc_now(int $offsetSeconds = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $offsetSeconds);
}

/** '2026-11-16 10:00:00.123' (UTC) → '2026-11-16T10:00:00.123Z' */
function db_time_to_iso(?string $value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    return str_replace(' ', 'T', $value) . 'Z';
}

function is_list_array(array $a): bool
{
    return $a === [] || array_keys($a) === range(0, count($a) - 1);
}
