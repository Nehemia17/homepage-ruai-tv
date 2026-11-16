<?php
/**
 * Buat akun admin baru, atau reset password akun yang sudah ada. Hanya lewat CLI.
 *
 *   php api/tools/create-admin.php EMAIL "Nama Lengkap" [--generate] [--print-sql]
 *
 *   --generate   buat password acak dan tampilkan sekali (tanpa ini, password ditanya)
 *   --print-sql  jangan sentuh database; cetak perintah SQL untuk ditempel di phpMyAdmin
 *                (berguna di hosting tanpa SSH: jalankan di komputer lokal, tempel di cPanel)
 *
 * Password minimal 10 karakter. Hanya hash bcrypt yang disimpan.
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$args = array_slice($argv, 1);
$flags = array_values(array_filter($args, static fn($a) => str_starts_with($a, '--')));
$pos = array_values(array_filter($args, static fn($a) => !str_starts_with($a, '--')));
$generate = in_array('--generate', $flags, true);
$printSql = in_array('--print-sql', $flags, true);

$email = strtolower(trim($pos[0] ?? ''));
$fullName = trim($pos[1] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
    fwrite(STDERR, "Pemakaian: php api/tools/create-admin.php EMAIL \"Nama Lengkap\" [--generate] [--print-sql]\n");
    exit(1);
}
if ($fullName === '') {
    $fullName = $email;
}
$fullName = mb_substr($fullName, 0, 120);

function ask_hidden(string $prompt): string
{
    echo $prompt;
    $hidden = false;
    if (DIRECTORY_SEPARATOR === '/' && function_exists('shell_exec') && function_exists('posix_isatty') && posix_isatty(STDIN)) {
        shell_exec('stty -echo');
        $hidden = true;
    }
    $line = fgets(STDIN);
    if ($hidden) {
        shell_exec('stty echo');
        echo PHP_EOL;
    }
    return rtrim((string) $line, "\r\n");
}

if ($generate) {
    $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $password = '';
    for ($i = 0; $i < 16; $i++) {
        $password .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
} else {
    $password = ask_hidden('Password baru (min. 10 karakter): ');
    if (DIRECTORY_SEPARATOR === '\\') {
        echo "(Catatan: di Windows password terlihat saat diketik.)\n";
    }
    if ($password !== ask_hidden('Ulangi password: ')) {
        fwrite(STDERR, "Password tidak sama.\n");
        exit(1);
    }
}
if (strlen($password) < 10) {
    fwrite(STDERR, "Password minimal 10 karakter.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

if ($printSql) {
    $q = static fn(string $s) => "'" . str_replace(["\\", "'"], ["\\\\", "''"], $s) . "'";
    echo "-- Tempel di phpMyAdmin (tab SQL) pada database Ruai TV:\n";
    echo 'INSERT INTO admins (email, full_name, password_hash, role) VALUES ('
        . $q($email) . ', ' . $q($fullName) . ', ' . $q($hash) . ", 'admin')\n"
        . "ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash);\n";
} else {
    require_once __DIR__ . '/../lib/bootstrap.php';
    $stmt = db()->prepare(
        "INSERT INTO admins (email, full_name, password_hash, role) VALUES (?, ?, ?, 'admin')
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash)"
    );
    $stmt->execute([$email, $fullName, $hash]);
    // Cabut semua sesi lama bila ini reset password.
    db()->prepare('DELETE s FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE a.email = ?')->execute([$email]);
    echo "Akun admin siap: $email\n";
}

if ($generate) {
    echo "Password (catat sekarang, tidak ditampilkan lagi): $password\n";
}
