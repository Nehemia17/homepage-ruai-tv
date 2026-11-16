<?php
/**
 * RUAI TV API — /api/auth.php
 *   POST ?action=login   {email, password, remember}  → {user, csrf_token, expires_at} + cookie sesi
 *   POST ?action=logout                               → {ok: true}
 *   GET  ?action=me                                   → {user, csrf_token, expires_at} atau 401
 */
declare(strict_types=1);

require_once __DIR__ . '/lib/auth.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        require_method(['POST']);
        $body = read_json_body();
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';
        if (!is_string($email) || !is_string($password)) {
            api_fail(400, 'Email dan password wajib diisi.');
        }
        json_out(admin_login($email, $password, !empty($body['remember'])));
        break;

    case 'logout':
        require_method(['POST']);
        admin_logout();
        json_out(['ok' => true]);
        break;

    case 'me':
        require_method(['GET']);
        $admin = current_admin();
        if ($admin === null) {
            api_fail(401, 'Sesi login berakhir. Silakan login kembali.', 'AUTH_REQUIRED');
        }
        if ($admin['user']['role'] !== 'admin') {
            api_fail(403, 'Akun ini tidak memiliki akses admin.', 'FORBIDDEN');
        }
        json_out($admin);
        break;

    default:
        api_fail(404, 'Aksi tidak dikenal.');
}
