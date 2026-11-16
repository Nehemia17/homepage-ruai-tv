<?php
/**
 * RUAI TV API — model Program: validasi input, konversi baris DB ⇄ JSON API, upsert.
 * Validasi di sini menggantikan CHECK constraint & RLS lama; jangan dilonggarkan.
 */
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

const PROGRAM_CATEGORIES = ['berita', 'non-news', 'kerja-sama'];
const PROGRAM_STATUSES = ['aktif', 'arsip'];
const PROGRAM_SLOTS = ['pagi', 'siang', 'malam'];

const PROGRAM_COLUMNS = [
    'id', 'title', 'slug', 'category', 'category_label', 'status', 'format', 'duration',
    'description', 'thumbnail_url', 'promo_video_url', 'youtube_live_url', 'schedule_json', 'featured',
];

/** Teks 1 baris → bersih (tanpa karakter kontrol), atau null bila kosong. */
function pv_clean_line(string $s): string
{
    return trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s));
}

/** Teks multi-baris → hapus karakter kontrol selain \n, \r, \t. */
function pv_clean_text(string $s): string
{
    return trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s));
}

function pv_is_http_url(string $s): bool
{
    return preg_match('#^https?://[^\s]+$#i', $s) === 1 && filter_var($s, FILTER_VALIDATE_URL) !== false;
}

/** Path relatif (assets/..., /uploads/...) atau URL http(s). Menolak javascript:, data:, '..', dsb. */
function pv_is_asset_url(string $s): bool
{
    if (pv_is_http_url($s)) {
        return true;
    }
    return preg_match('#^/?[A-Za-z0-9_\-./%]+$#', $s) === 1
        && !str_contains($s, '..')
        && !str_contains($s, '//');
}

/**
 * @param array $in           data mentah dari klien
 * @param bool  $requireCore  true = upsert penuh (id, title, slug wajib); false = PATCH sebagian
 * @return array{0: array, 1: array}  [data bersih siap simpan, daftar galat per field]
 */
function program_validate(array $in, bool $requireCore): array
{
    $out = [];
    $errors = [];

    $unknown = array_diff(array_keys($in), array_merge(PROGRAM_COLUMNS, ['created_at', 'updated_at']));
    foreach ($unknown as $key) {
        $errors[(string) $key] = 'Field tidak dikenal.';
    }

    $stringField = static function (string $key, int $max, bool $nullable, string $mode = 'line') use ($in, &$out, &$errors): void {
        if (!array_key_exists($key, $in)) {
            return;
        }
        $v = $in[$key];
        if ($v === null) {
            if ($nullable) {
                $out[$key] = null;
            } else {
                $errors[$key] = 'Wajib diisi.';
            }
            return;
        }
        if (!is_string($v)) {
            $errors[$key] = 'Harus berupa teks.';
            return;
        }
        if (!mb_check_encoding($v, 'UTF-8')) {
            $errors[$key] = 'Teks bukan UTF-8 yang valid.';
            return;
        }
        $v = $mode === 'text' ? pv_clean_text($v) : pv_clean_line($v);
        if ($v === '') {
            if ($nullable) {
                $out[$key] = null;
            } else {
                $errors[$key] = 'Wajib diisi.';
            }
            return;
        }
        if (mb_strlen($v) > $max) {
            $errors[$key] = "Maksimal $max karakter.";
            return;
        }
        $out[$key] = $v;
    };

    // id & slug: huruf kecil/angka dipisah tanda hubung (sama seperti pembuat slug di admin panel)
    foreach (['id' => 64, 'slug' => 255] as $key => $max) {
        $stringField($key, $max, false);
        if (isset($out[$key]) && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $out[$key]) !== 1) {
            $errors[$key] = 'Hanya huruf kecil, angka, dan tanda hubung.';
        }
    }
    $stringField('title', 255, false);
    $stringField('category_label', 100, true);
    $stringField('format', 100, true);
    $stringField('duration', 50, true);
    $stringField('description', 10000, true, 'text');

    foreach (['category' => PROGRAM_CATEGORIES, 'status' => PROGRAM_STATUSES] as $key => $allowed) {
        if (array_key_exists($key, $in)) {
            if (!is_string($in[$key]) || !in_array($in[$key], $allowed, true)) {
                $errors[$key] = 'Nilai harus salah satu dari: ' . implode(', ', $allowed) . '.';
            } else {
                $out[$key] = $in[$key];
            }
        }
    }

    foreach (['thumbnail_url' => 'asset', 'promo_video_url' => 'http', 'youtube_live_url' => 'http'] as $key => $kind) {
        $stringField($key, 2000, true);
        if (isset($out[$key])) {
            $ok = $kind === 'asset' ? pv_is_asset_url($out[$key]) : pv_is_http_url($out[$key]);
            if (!$ok) {
                $errors[$key] = $kind === 'asset'
                    ? 'Harus berupa URL http(s) atau path file (tanpa spasi).'
                    : 'Harus berupa URL http(s).';
            }
        }
    }

    if (array_key_exists('featured', $in)) {
        $f = $in['featured'];
        if (is_bool($f)) {
            $out['featured'] = $f ? 1 : 0;
        } elseif ($f === 0 || $f === 1) {
            $out['featured'] = $f;
        } else {
            $errors['featured'] = 'Harus true atau false.';
        }
    }

    if (array_key_exists('schedule_json', $in)) {
        $schedule = $in['schedule_json'];
        if ($schedule === null) {
            $out['schedule_json'] = null;
        } else {
            $problem = program_schedule_problem($schedule);
            if ($problem !== null) {
                $errors['schedule_json'] = $problem;
            } else {
                $out['schedule_json'] = json_encode($schedule, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }
    }

    if ($requireCore) {
        foreach (['id', 'title', 'slug'] as $key) {
            if (!isset($out[$key]) && !isset($errors[$key])) {
                $errors[$key] = 'Wajib diisi.';
            }
        }
    } elseif (array_key_exists('id', $in)) {
        $errors['id'] = 'ID tidak boleh diubah.';
    }

    return [$out, $errors];
}

/** Bentuk: {pagi|siang|malam: {active: bool, label: str|null, time: str|null, days: str|null}} */
function program_schedule_problem($schedule): ?string
{
    if (!is_array($schedule) || ($schedule !== [] && is_list_array($schedule))) {
        return 'Harus berupa objek {pagi, siang, malam}.';
    }
    foreach ($schedule as $slot => $entry) {
        if (!in_array($slot, PROGRAM_SLOTS, true)) {
            return "Slot \"$slot\" tidak dikenal (hanya pagi, siang, malam).";
        }
        if (!is_array($entry) || is_list_array($entry)) {
            return "Slot \"$slot\" harus berupa objek.";
        }
        foreach ($entry as $k => $v) {
            if (!in_array($k, ['active', 'label', 'time', 'days'], true)) {
                return "Slot \"$slot\" memiliki field tidak dikenal: $k.";
            }
            if ($k === 'active' ? !is_bool($v) : ($v !== null && (!is_string($v) || mb_strlen($v) > 100))) {
                return "Slot \"$slot\": nilai \"$k\" tidak valid.";
            }
        }
    }
    return null;
}

/** Baris DB → bentuk JSON API (sama dengan respons Supabase lama agar UI tidak berubah). */
function program_to_api(array $row): array
{
    $schedule = null;
    if ($row['schedule_json'] !== null && $row['schedule_json'] !== '') {
        $decoded = json_decode((string) $row['schedule_json'], true);
        $schedule = is_array($decoded) ? $decoded : null;
    }
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'slug' => $row['slug'],
        'category' => $row['category'],
        'category_label' => $row['category_label'],
        'status' => $row['status'],
        'format' => $row['format'],
        'duration' => $row['duration'],
        'description' => $row['description'],
        'thumbnail_url' => $row['thumbnail_url'],
        'promo_video_url' => $row['promo_video_url'],
        'youtube_live_url' => $row['youtube_live_url'],
        'schedule_json' => $schedule,
        'featured' => (bool) $row['featured'],
        'created_at' => db_time_to_iso($row['created_at']),
        'updated_at' => db_time_to_iso($row['updated_at']),
    ];
}

function program_find(string $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM programs WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? program_to_api($row) : null;
}

function programs_all(): array
{
    $rows = db()->query('SELECT * FROM programs ORDER BY created_at DESC, id ASC')->fetchAll();
    return array_map('program_to_api', $rows);
}

/** Insert atau update (hanya kolom yang dikirim yang berubah). `$clean` hasil program_validate(). */
function program_upsert(array $clean): array
{
    $cols = array_keys($clean);
    $placeholders = implode(', ', array_fill(0, count($cols), '?'));
    $updates = [];
    foreach ($cols as $c) {
        if ($c !== 'id') {
            $updates[] = "`$c` = VALUES(`$c`)";
        }
    }
    $sql = 'INSERT INTO programs (`' . implode('`, `', $cols) . "`) VALUES ($placeholders)"
        . ($updates ? ' ON DUPLICATE KEY UPDATE ' . implode(', ', $updates) : '');
    db()->prepare($sql)->execute(array_values($clean));
    return program_find($clean['id']);
}

function program_update(string $id, array $clean): ?array
{
    if ($clean === []) {
        return program_find($id);
    }
    $sets = [];
    foreach (array_keys($clean) as $c) {
        $sets[] = "`$c` = ?";
    }
    $stmt = db()->prepare('UPDATE programs SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute([...array_values($clean), $id]);
    // rowCount() = 0 juga bila nilainya identik, jadi cek keberadaan baris secara terpisah.
    return program_find($id);
}

function program_delete(string $id): bool
{
    $stmt = db()->prepare('DELETE FROM programs WHERE id = ?');
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}
