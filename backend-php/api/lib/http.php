<?php
/**
 * RUAI TV API — lapisan HTTP: header keamanan, CORS/Origin, helper request & response.
 * Di-include oleh setiap endpoint web.
 */
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function is_unsafe_method(?string $method = null): bool
{
    return !in_array($method ?? request_method(), ['GET', 'HEAD', 'OPTIONS'], true);
}

function origin_is_same_site(string $origin): bool
{
    $host = parse_url($origin, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        return false;
    }
    $port = parse_url($origin, PHP_URL_PORT);
    $originHost = strtolower($host . ($port ? ':' . $port : ''));
    return $originHost === strtolower($_SERVER['HTTP_HOST'] ?? '');
}

/**
 * - Origin lain yang tidak terdaftar tidak boleh menulis (403).
 * - Origin terdaftar (cors_allowed_origins) mendapat header CORS dengan kredensial.
 */
function ruai_apply_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }

    $allowed = array_map(static fn($o) => rtrim((string) $o, '/'), ruai_config()['cors_allowed_origins']);
    $isAllowed = in_array(rtrim($origin, '/'), $allowed, true);

    if ($isAllowed) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
        header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 600');
        header('Vary: Origin');
    }

    if (request_method() === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if (is_unsafe_method() && !$isAllowed && !origin_is_same_site($origin)) {
        api_fail(403, 'Asal permintaan (Origin) tidak diizinkan.', 'ORIGIN');
    }
}
ruai_apply_cors();

// ─── Response ───
function json_out($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// ─── Request ───
/** Body JSON wajib ber-Content-Type application/json (sekaligus mencegah form-CSRF lintas situs). */
function read_json_body(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== 0) {
        api_fail(415, 'Content-Type harus application/json.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 262145);
    if ($raw === false || $raw === '') {
        api_fail(400, 'Isi permintaan kosong.');
    }
    if (strlen($raw) > 262144) {
        api_fail(413, 'Permintaan terlalu besar.');
    }
    try {
        $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        api_fail(400, 'JSON tidak valid.');
    }
    if (!is_array($data) || is_list_array($data) && $data !== []) {
        api_fail(400, 'Isi permintaan harus berupa objek JSON.');
    }
    return $data;
}

function require_method(array $allowed): string
{
    $method = request_method();
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        api_fail(405, 'Metode ' . $method . ' tidak didukung.');
    }
    return $method;
}
