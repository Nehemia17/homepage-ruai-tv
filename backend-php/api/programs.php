<?php
/**
 * RUAI TV API — /api/programs.php
 *   GET                 → daftar semua program (publik)
 *   GET    ?id=slug     → satu program (publik)
 *   POST                → tambah/ubah program, body = data program (admin)
 *   PATCH  ?id=slug     → ubah sebagian field (admin)
 *   DELETE ?id=slug     → hapus (admin)
 *
 * Penegakan hak akses ada di sini (require_admin), bukan di JavaScript.
 */
declare(strict_types=1);

require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/programs.php';

function program_id_param(): string
{
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $id) !== 1 || strlen($id) > 64) {
        api_fail(400, 'Parameter id tidak valid.');
    }
    return $id;
}

function program_validation_failure(array $errors): void
{
    api_fail(422, 'Data program tidak valid: ' . implode('; ', array_map(
        static fn($k, $v) => "$k — $v",
        array_keys($errors),
        $errors
    )), 'VALIDATION', ['details' => $errors]);
}

switch (require_method(['GET', 'POST', 'PATCH', 'DELETE'])) {
    case 'GET':
        if (isset($_GET['id'])) {
            $program = program_find(program_id_param());
            if ($program === null) {
                api_fail(404, 'Program tidak ditemukan.');
            }
            json_out($program);
        }
        // ETag agar browser cukup memvalidasi ulang (cepat) tanpa mengunduh ulang daftar yang sama.
        $payload = json_encode(programs_all(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        $etag = '"' . md5($payload) . '"';
        header('Cache-Control: no-cache');
        header('ETag: ' . $etag);
        if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
            http_response_code(304);
            exit;
        }
        echo $payload;
        break;

    case 'POST':
        require_admin();
        [$clean, $errors] = program_validate(read_json_body(), true);
        if ($errors) {
            program_validation_failure($errors);
        }
        json_out(program_upsert($clean));
        break;

    case 'PATCH':
        require_admin();
        $id = program_id_param();
        [$clean, $errors] = program_validate(read_json_body(), false);
        if ($errors) {
            program_validation_failure($errors);
        }
        $updated = program_find($id) === null ? null : program_update($id, $clean);
        if ($updated === null) {
            api_fail(404, 'Program tidak ditemukan.');
        }
        json_out($updated);
        break;

    case 'DELETE':
        require_admin();
        if (!program_delete(program_id_param())) {
            api_fail(404, 'Program tidak ditemukan.');
        }
        json_out(['ok' => true]);
        break;
}
