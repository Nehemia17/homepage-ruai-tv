<?php
/**
 * RUAI TV API — autentikasi admin: login, sesi (cookie HttpOnly + token di DB),
 * proteksi CSRF, dan pembatasan percobaan login.
 */
declare(strict_types=1);

require_once __DIR__ . '/http.php';

const RUAI_SESSION_COOKIE = 'ruai_sid';

// Hash bcrypt acak yang tidak cocok dengan password apa pun. Dipakai agar waktu
// respons sama baik email terdaftar maupun tidak (mencegah enumerasi akun).
const RUAI_DUMMY_HASH = '$2y$11$VOmQ8OIYEeh.rdSQx3yrX.kE5bLiF5FRdhMsir9ohKAYPihMaASaa';

const RUAI_LOGIN_WINDOW = 900;      // detik (15 menit)
const RUAI_LOGIN_MAX_PAIR = 5;      // gagal per (IP + email)
const RUAI_LOGIN_MAX_IP = 20;       // gagal per IP
const RUAI_LOGIN_MAX_EMAIL = 40;    // gagal per email dari semua IP

function client_ip(): string
{
    if (ruai_config()['trust_proxy_headers']) {
        $fwd = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($fwd !== '') {
            $first = trim(explode(',', $fwd)[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) {
                return $first;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function request_is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    return ruai_config()['trust_proxy_headers']
        && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function session_cookie_path(): string
{
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x.php')), '/');
    return $dir === '' ? '/' : $dir;
}

function set_session_cookie(string $value, int $expires): void
{
    $samesite = (string) ruai_config()['session']['cookie_samesite'];
    setcookie(RUAI_SESSION_COOKIE, $value, [
        'expires' => $expires,
        'path' => session_cookie_path(),
        'secure' => request_is_https(),
        'httponly' => true,
        'samesite' => in_array($samesite, ['Strict', 'Lax', 'None'], true) ? $samesite : 'Strict',
    ]);
}

function session_cookie_token(): ?string
{
    $token = $_COOKIE[RUAI_SESSION_COOKIE] ?? '';
    return is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token) ? $token : null;
}

function user_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'fullname' => $row['full_name'],
        'role' => $row['role'],
    ];
}

/** Sesi admin yang sedang aktif (atau null). Hasilnya di-cache per request. */
function current_admin(): ?array
{
    static $resolved = false, $admin = null;
    if ($resolved) {
        return $admin;
    }
    $resolved = true;

    $token = session_cookie_token();
    if ($token === null) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT s.csrf_token, s.expires_at, a.id, a.email, a.full_name, a.role
           FROM admin_sessions s
           JOIN admins a ON a.id = s.admin_id
          WHERE s.token_hash = ? AND s.expires_at > ?'
    );
    $stmt->execute([hash('sha256', $token), utc_now()]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $admin = [
        'user' => user_payload($row),
        'csrf_token' => $row['csrf_token'],
        'expires_at' => (int) strtotime($row['expires_at'] . ' UTC'),
    ];
    return $admin;
}

/** Wajib login sebagai admin; untuk metode tulis juga wajib token CSRF yang benar. */
function require_admin(): array
{
    $admin = current_admin();
    if ($admin === null) {
        api_fail(401, 'Sesi login berakhir. Silakan login kembali.', 'AUTH_REQUIRED');
    }
    if ($admin['user']['role'] !== 'admin') {
        api_fail(403, 'Akun ini tidak memiliki akses admin.', 'FORBIDDEN');
    }
    if (is_unsafe_method()) {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($sent) || $sent === '' || !hash_equals($admin['csrf_token'], $sent)) {
            api_fail(403, 'Token keamanan tidak valid. Muat ulang halaman atau login kembali.', 'CSRF');
        }
    }
    return $admin;
}

function login_hashes(string $email): array
{
    return [hash('sha256', client_ip()), hash('sha256', $email)];
}

function assert_login_not_throttled(string $ipHash, string $emailHash): void
{
    $stmt = db()->prepare(
        'SELECT COALESCE(SUM(ip_hash = ? AND email_hash = ?), 0) AS pair_fails,
                COALESCE(SUM(ip_hash = ?), 0) AS ip_fails,
                COALESCE(SUM(email_hash = ?), 0) AS email_fails
           FROM login_attempts WHERE attempted_at >= ?'
    );
    $stmt->execute([$ipHash, $emailHash, $ipHash, $emailHash, utc_now(-RUAI_LOGIN_WINDOW)]);
    $r = $stmt->fetch();
    if ((int) $r['pair_fails'] >= RUAI_LOGIN_MAX_PAIR
        || (int) $r['ip_fails'] >= RUAI_LOGIN_MAX_IP
        || (int) $r['email_fails'] >= RUAI_LOGIN_MAX_EMAIL) {
        api_fail(429, 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.', 'RATE_LIMITED', ['retry_after' => RUAI_LOGIN_WINDOW]);
    }
}

function record_login_failure(string $ipHash, string $emailHash): void
{
    $pdo = db();
    $pdo->prepare('INSERT INTO login_attempts (ip_hash, email_hash) VALUES (?, ?)')->execute([$ipHash, $emailHash]);
    if (random_int(1, 20) === 1) {
        $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < ?')->execute([utc_now(-86400)]);
    }
}

/** Verifikasi kredensial dan buat sesi. Mengembalikan payload yang sama seperti current_admin(). */
function admin_login(string $email, string $password, bool $remember): array
{
    $email = strtolower(trim($email));
    if ($email === '' || $password === '' || strlen($email) > 190 || strlen($password) > 1024) {
        api_fail(400, 'Email dan password wajib diisi.');
    }

    [$ipHash, $emailHash] = login_hashes($email);
    assert_login_not_throttled($ipHash, $emailHash);

    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, email, full_name, password_hash, role FROM admins WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch() ?: null;

    $valid = password_verify($password, $row['password_hash'] ?? RUAI_DUMMY_HASH);
    if (!$row || !$valid) {
        record_login_failure($ipHash, $emailHash);
        api_fail(401, 'Email atau password salah.', 'INVALID_CREDENTIALS');
    }
    if ($row['role'] !== 'admin') {
        api_fail(403, 'Akun ini tidak memiliki akses admin.', 'FORBIDDEN');
    }

    if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $row['id']]);
    }

    $pdo->prepare('DELETE FROM login_attempts WHERE ip_hash = ? AND email_hash = ?')->execute([$ipHash, $emailHash]);
    $pdo->prepare('DELETE FROM admin_sessions WHERE expires_at < ?')->execute([utc_now()]);
    $pdo->prepare('UPDATE admins SET last_login_at = ? WHERE id = ?')->execute([utc_now(), $row['id']]);

    $cfg = ruai_config()['session'];
    $ttl = $remember ? (int) $cfg['remember_days'] * 86400 : (int) $cfg['default_hours'] * 3600;
    $token = bin2hex(random_bytes(32));
    $csrf = bin2hex(random_bytes(24));

    $pdo->prepare(
        'INSERT INTO admin_sessions (token_hash, admin_id, csrf_token, expires_at, ip_hash, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([
        hash('sha256', $token), $row['id'], $csrf, utc_now($ttl), $ipHash,
        substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
    ]);

    // "Ingat saya" = cookie persisten; tanpa itu cookie hilang saat browser ditutup.
    set_session_cookie($token, $remember ? time() + $ttl : 0);

    return [
        'user' => user_payload($row),
        'csrf_token' => $csrf,
        'expires_at' => time() + $ttl,
    ];
}

function admin_logout(): void
{
    $token = session_cookie_token();
    if ($token !== null) {
        db()->prepare('DELETE FROM admin_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    set_session_cookie('', time() - 3600);
}
